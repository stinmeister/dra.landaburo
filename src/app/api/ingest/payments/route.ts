import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistReviewItems } from "@/lib/ingest-review";

// POST /api/ingest/payments
// Auth: Authorization: Bearer $INGEST_SECRET
//
// Acepta un array de registros de cobros exportados desde la hoja Citas_Raw
// (Base Unificada v2) procesados por n8n.
//
// ────────────────────────────────────────────────────────────────────────────
// DDL_PENDING — columnas que AÚN NO existen en payments:
//   ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;
//   ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;
// DDL_PENDING — valores de payment_method pendientes de agregar al CHECK constraint:
//   tarjeta_debito | efectivo_usd | cheque
// ────────────────────────────────────────────────────────────────────────────
//
// CORRECCIONES implementadas respecto a versión anterior:
//
//  B1 — Nuevo schema de entrada: PaymentRecord representa Citas_Raw campo a campo.
//       (clave_unica, dni, fecha, servicio, estado, monto_pagado_ars, …)
//
//  B2 — Filtrado por Estado antes de cualquier procesamiento:
//       Solo 'Finalizado' genera un pago. ESTADOS_IGNORAR se descartan en silencio.
//       Estados desconocidos van a needs_review('estado_desconocido').
//
//  B3 — Doble deduplicación:
//       Nivel 1 (exacta): por clave_unica si la columna external_id existe (DDL_PENDING).
//       Nivel 2 (aproximada): por patient_id + payment_date (rango del día) + amount_ars.
//
//  B4 — Detección de moneda (ARS / USD / SUSPICIOUS).
//
//  B5 — Mapa de profesionales leído en runtime desde profiles (sin UUIDs hardcodeados).
//
//  B6 — Normalización de medio_pago con tabla explícita. Valores DDL_PENDING marcados.
//
//  B7 — Lookup de paciente por DNI (no por teléfono como en la versión anterior).
//
//  B8 — INGEST_SECRET: sin la variable, el endpoint devuelve 401. Esto es ESPERADO
//       hasta que se cargue la variable en el servidor.

// ─── Supabase admin ───────────────────────────────────────────────────────────

const supabaseAdmin = createAdminClient();

// ─── Constantes de estado ─────────────────────────────────────────────────────

const ESTADOS_FACTURABLES = new Set(["Finalizado"]);

// Estos estados representan citas que no generaron ingreso real.
// Se descartan en silencio (no son errores, no son pagos).
const ESTADOS_IGNORAR = new Set([
  "Programado",
  "Confirmado",
  "Cancelado",
  "Ausente",
]);

// ─── Constantes de moneda ─────────────────────────────────────────────────────

const MONTO_SOSPECHOSO_UMBRAL = 5000; // < 5000 ARS en servicios USD = sospechoso

const SERVICIOS_USD = [
  "botox completo",
  "botox masetero",
  "ácido hialurónico",
  "acido hialuronico",
  "sculptra",
  "elleva",
  "sculptra bioestimulador",
];

// ─── Mapa de medios de pago ───────────────────────────────────────────────────
// Clave: valor raw de la hoja (lowercase). Valor: valor normalizado para la DB.
//
// PAYMENT_METHOD_MAP_ACCEPTED: el CHECK constraint actual en payments acepta estos.
// PAYMENT_METHOD_MAP_DDL_PENDING: métodos reconocidos pero que aún NO están en el
//   constraint. El endpoint los envía a needs_review con 'metodo_pago_ddl_pendiente'
//   en lugar de dejar que Postgres los rechace con un error críptico.
//   DDL a aplicar para habilitarlos:
//     ALTER TABLE public.payments DROP CONSTRAINT payments_payment_method_check;
//     ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
//       CHECK (payment_method IN ('efectivo','transferencia','mercadopago',
//                                 'tarjeta_debito','efectivo_usd','cheque'));

const PAYMENT_METHOD_MAP_ACCEPTED: Record<string, string> = {
  efectivo: "efectivo",
  transferencia: "transferencia",
  mercadopago: "mercadopago",
  "mercado pago": "mercadopago",
};

const PAYMENT_METHOD_MAP_DDL_PENDING: Record<string, string> = {
  "tarjeta de debito": "tarjeta_debito",
  "tarjeta de débito": "tarjeta_debito",
  debito: "tarjeta_debito",
  "efectivo usd": "efectivo_usd",
  cheque: "cheque",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Payload que n8n envía por cada fila de Citas_Raw. */
interface PaymentRecord {
  // ── Campos de Citas_Raw ──
  clave_unica: string;               // Clave_Unica (external_id primario)
  dni: string;                       // DNI del paciente (puede tener puntos/espacios)
  fecha: string;                     // Fecha en formato 'D/M/YYYY' e.g. '31/7/2026'
  servicio: string;                  // Servicio (string libre, puede ser multi)
  estado: string;                    // Estado raw — el endpoint filtra
  monto_pagado_ars: number;          // Puede ser 0 o negativo
  deuda_ars: number;                 // Deuda residual (trazabilidad)
  medio_pago: string;                // Medio_Pago raw — el endpoint normaliza
  profesional: string;               // e.g. 'Landaburo, Natalia'
  archivo_origen?: string;           // Trazabilidad: nombre del archivo fuente

  // ── Resolución opcional (si n8n ya los resolvió) ──
  patient_id?: string;               // uuid si n8n ya lo resolvió por DNI
  professional_profile_id?: string;  // uuid si n8n ya lo resolvió
}

interface NeedsReviewItem {
  index: number;
  reason: string;
  record: PaymentRecord;
}

interface RejectedItem {
  index: number;
  reason: string;
  record: PaymentRecord;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parsea fecha y hora completas.
 * Prioridad 1: Clave_Unica (DNI|YYYY-MM-DDTHH:mm:ss|Servicio) preservando la hora del cobro.
 * Prioridad 2: Columna fecha en formato D/M/YYYY (00:00).
 * Zona horaria Argentina (-03:00).
 * No aplica doble correccion del bug de Calu (WF-01 ya lo corrige al escribir la Sheet).
 */
function parsePaymentDate(claveUnica: string | undefined, fechaRaw: string | undefined): Date | null {
  if (claveUnica && claveUnica.includes("|")) {
    const parts = claveUnica.split("|");
    if (parts.length >= 2) {
      const tsPart = parts[1].trim();
      if (tsPart.includes("T") || tsPart.match(/^\d{4}-\d{2}-\d{2}/)) {
        const hasTz = tsPart.endsWith("Z") || tsPart.includes("+") || tsPart.slice(10).includes("-");
        const withTz = hasTz ? tsPart : `${tsPart}-03:00`;
        const dt = new Date(withTz);
        if (!isNaN(dt.getTime())) return dt;
      }
    }
  }

  if (fechaRaw) {
    const parts = fechaRaw.trim().split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00-03:00`;
      const dt = new Date(iso);
      if (!isNaN(dt.getTime())) return dt;
    }
  }

  return null;
}

/**
 * Normaliza DNI: elimina puntos, espacios y caracteres no numéricos.
 */
function normalizeDni(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/**
 * Detecta si el monto/servicio/medio_pago corresponde a USD, es sospechoso, o es ARS.
 */
function detectCurrency(
  medioPago: string,
  montoArs: number,
  servicio: string
): "ARS" | "USD" | "SUSPICIOUS" {
  const mp = medioPago.toLowerCase();
  if (mp.includes("usd") || mp.includes("dolar") || mp.includes("dólar")) {
    return "USD";
  }
  const servicioLower = servicio.toLowerCase();
  if (
    montoArs > 0 &&
    montoArs < MONTO_SOSPECHOSO_UMBRAL &&
    SERVICIOS_USD.some((s) => servicioLower.includes(s))
  ) {
    return "SUSPICIOUS";
  }
  return "ARS";
}

/**
 * Lookup de paciente por DNI normalizado.
 * Retorna:
 *   - { id: string } si hay exactamente un match
 *   - 'ambiguous'   si hay más de un match
 *   - null          si no hay match o DNI inválido
 */
async function resolvePatientByDni(
  dni: string
): Promise<{ id: string } | "ambiguous" | null> {
  const normDni = normalizeDni(dni);
  if (!normDni || normDni.length < 7) return null;

  const { data, error } = await supabaseAdmin
    .from("patients")
    .select("id")
    .eq("dni", normDni);

  if (error || !data) return null;
  if (data.length === 0) return null;
  if (data.length > 1) return "ambiguous";
  return data[0];
}

/**
 * Lee los perfiles de profesionales desde la DB y construye un mapa
 * 'nombre en planilla' → uuid.
 * Se llama UNA SOLA VEZ por request para evitar N queries.
 */
async function getProfesionalMap(): Promise<Map<string, string>> {
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "medico", "cosmetologa"]);

  const map = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (!p.full_name || !p.id) continue;
    const nameLower = p.full_name.toLowerCase();

    // Match exacto del nombre completo tal como aparece en la planilla
    map.set(p.full_name, p.id);

    // Alias por apellido conocido (formato 'Apellido, Nombre')
    if (nameLower.includes("landaburo")) {
      map.set("Landaburo, Natalia", p.id);
      map.set("Landaburo, Paula", p.id);
    }
    if (nameLower.includes("pasquet")) {
      map.set("Pasquet, Mercedes", p.id);
    }
  }
  return map;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {

  // ── 1. Autenticación ────────────────────────────────────────────────────────
  // NOTA B8: INGEST_SECRET aún no está cargado en el servidor.
  // Todo request devolverá 401 hasta que la variable esté disponible.
  // Esto es comportamiento esperado y correcto — NO deshabilitar este bloque.
  const authHeader = req.headers.get("authorization");
  const secret = process.env.INGEST_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  // ── 2. Parseo del body ──────────────────────────────────────────────────────
  let records: PaymentRecord[];
  try {
    const body = await req.json();
    records = Array.isArray(body) ? body : body.records;
    if (!Array.isArray(records)) {
      throw new Error("Payload debe ser array o { records: [] }");
    }
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: `JSON inválido: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 400 }
    );
  }

  // ── 3. Carga de mapa de profesionales (una sola vez por request) ────────────
  const profesionalMap = await getProfesionalMap();

  // ── 4. Acumuladores ─────────────────────────────────────────────────────────
  let inserted = 0;
  let inserted_with_warnings = 0;
  let skipped_estado = 0;
  let duplicates_exact = 0;
  let duplicates_approx = 0;
  let needs_review_uninserted = 0;
  const needs_review: NeedsReviewItem[] = [];
  const rejected: RejectedItem[] = [];

  // ── 5. Procesamiento por registro ───────────────────────────────────────────
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // ── 5.1 Validación mínima de campos requeridos → rejected ────────────────
    if (!rec.clave_unica?.trim()) {
      rejected.push({ index: i, reason: "clave_unica es requerida", record: rec });
      continue;
    }
    if (!rec.dni?.trim()) {
      rejected.push({ index: i, reason: "dni es requerido", record: rec });
      continue;
    }
    if (!rec.fecha?.trim()) {
      rejected.push({ index: i, reason: "fecha es requerida", record: rec });
      continue;
    }
    if (rec.monto_pagado_ars == null) {
      rejected.push({ index: i, reason: "monto_pagado_ars es requerido", record: rec });
      continue;
    }
    if (!rec.estado?.trim()) {
      rejected.push({ index: i, reason: "estado es requerido", record: rec });
      continue;
    }

    // ── 5.2 B2 — Filtrado por estado ─────────────────────────────────────────
    const estadoNorm = rec.estado.trim();

    if (!ESTADOS_FACTURABLES.has(estadoNorm)) {
      if (ESTADOS_IGNORAR.has(estadoNorm)) {
        // Cita no generó ingreso — descartar en silencio
        skipped_estado++;
        continue;
      }
      // Estado desconocido o 'Cita Eliminada...' → needs_review
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `estado_desconocido: "${estadoNorm}" no es facturable ni ignorable`,
        record: rec,
      });
      continue;
    }

    // ── 5.3 Parseo de fecha y hora ───────────────────────────────────────────
    const parsedDate = parsePaymentDate(rec.clave_unica, rec.fecha);
    if (!parsedDate) {
      rejected.push({
        index: i,
        reason: `fecha inválida: "${rec.fecha}" (o clave_unica "${rec.clave_unica}") — se espera formato D/M/YYYY o timestamp ISO`,
        record: rec,
      });
      continue;
    }

    // ── 5.4 B4 — Detección de moneda ─────────────────────────────────────────
    const montoRaw = rec.monto_pagado_ars;

    if (montoRaw < 0) {
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `monto_negativo: anomalia de fuente (monto_pagado_ars=${montoRaw})`,
        record: rec,
      });
      continue;
    }

    const currencyResult = detectCurrency(
      rec.medio_pago ?? "",
      montoRaw,
      rec.servicio ?? ""
    );

    if (currencyResult === "USD") {
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `moneda_usd: el registro parece estar en USD (medio_pago="${rec.medio_pago}", monto=${montoRaw})`,
        record: rec,
      });
      continue;
    }

    if (currencyResult === "SUSPICIOUS") {
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `monto_sospechoso_posible_usd: monto ${montoRaw} ARS es muy bajo para servicio "${rec.servicio}"`,
        record: rec,
      });
      continue;
    }

    // ── 5.5 B6 — Normalización de medio de pago ───────────────────────────────
    const medioPagoKey = rec.medio_pago?.toLowerCase()?.trim() ?? "";

    // Verificar primero si es un método DDL_PENDING para dar razón precisa
    if (PAYMENT_METHOD_MAP_DDL_PENDING[medioPagoKey]) {
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `metodo_pago_ddl_pendiente: "${rec.medio_pago}" → "${PAYMENT_METHOD_MAP_DDL_PENDING[medioPagoKey]}" reconocido pero no habilitado en el CHECK constraint aún (aplicar DDL)`,
        record: rec,
      });
      continue;
    }

    const medioPagoNorm = PAYMENT_METHOD_MAP_ACCEPTED[medioPagoKey];
    if (!medioPagoNorm) {
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `medio_pago_desconocido: "${rec.medio_pago}" no está en el mapa de métodos aceptados`,
        record: rec,
      });
      continue;
    }

    // ── Multi-servicio: flag para trazabilidad ────────────────────────────────
    const isMultiService = (rec.servicio ?? "").includes(",");

    // ── 5.6 B7 — Resolución de patient_id por DNI ────────────────────────────
    // patient_id es NOT NULL en DB — si no se resuelve, NO se puede insertar.
    let patientId: string | undefined = rec.patient_id;

    if (!patientId) {
      const lookupResult = await resolvePatientByDni(rec.dni);
      if (lookupResult === "ambiguous") {
        needs_review_uninserted++;
        needs_review.push({
          index: i,
          reason: `ambiguous_ref: múltiples pacientes coinciden con DNI "${normalizeDni(rec.dni)}"`,
          record: rec,
        });
        continue;
      }
      if (!lookupResult) {
        needs_review_uninserted++;
        needs_review.push({
          index: i,
          reason: `sin_paciente: no se encontró paciente con DNI "${normalizeDni(rec.dni)}"`,
          record: rec,
        });
        continue;
      }
      patientId = lookupResult.id;
    }

    // ── 5.7 B5 — Resolución de professional_profile_id ───────────────────────
    // professional_profile_id es NOT NULL en DB — obligatorio.
    let professionalId: string | undefined = rec.professional_profile_id;

    if (!professionalId) {
      const mapped = profesionalMap.get(rec.profesional?.trim() ?? "");
      if (!mapped) {
        needs_review_uninserted++;
        needs_review.push({
          index: i,
          reason: `sin_professional: "${rec.profesional}" no encontrado en profiles (asignar manualmente)`,
          record: rec,
        });
        continue;
      }
      professionalId = mapped;
    }

    // ── 5.8 B3 — Deduplicación Nivel 1 (exacta por clave_unica / external_id) ──
    // DDL_PENDING: esta query fallará si la columna external_id no existe aún.
    // En ese caso el error se atrapa y el registro va a rejected con DDL_PENDING.
    {
      const { data: existingByExtId, error: extIdError } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("external_id", rec.clave_unica)
        .maybeSingle();

      if (extIdError) {
        // Si el error es por columna inexistente → DDL_PENDING, seguir con nivel 2
        const isDdlPending =
          extIdError.message.includes("column") ||
          extIdError.message.includes("does not exist") ||
          extIdError.code === "42703";

        if (!isDdlPending) {
          // Error inesperado de DB → rejected
          rejected.push({
            index: i,
            reason: `Error al verificar external_id: ${extIdError.message}`,
            record: rec,
          });
          continue;
        }
        // DDL_PENDING detectado → continuar al nivel 2
      } else if (existingByExtId) {
        // Duplicado exacto encontrado → ignorar silenciosamente
        duplicates_exact++;
        continue;
      }
    }

    // ── 5.9 B3 — Deduplicación Nivel 2 (aproximada: patient_id + hora/fecha + monto) ─
    // Si parsedDate tiene hora específica (distinta de 00:00), busca en rango de ±15 minutos.
    // Si solo tiene fecha (00:00:00), busca en el rango del día.
    {
      const hasSpecificTime =
        parsedDate.getHours() !== 0 ||
        parsedDate.getMinutes() !== 0 ||
        parsedDate.getSeconds() !== 0;

      const winStart = hasSpecificTime
        ? new Date(parsedDate.getTime() - 15 * 60 * 1000)
        : new Date(new Date(parsedDate).setHours(0, 0, 0, 0));

      const winEnd = hasSpecificTime
        ? new Date(parsedDate.getTime() + 15 * 60 * 1000)
        : new Date(new Date(parsedDate).setHours(23, 59, 59, 999));

      const { data: existingApprox, error: approxError } = await supabaseAdmin
        .from("payments")
        .select("id, payment_date")
        .eq("patient_id", patientId)
        .eq("amount_ars", montoRaw)
        .gte("payment_date", winStart.toISOString())
        .lte("payment_date", winEnd.toISOString())
        .maybeSingle();

      if (!approxError && existingApprox) {
        duplicates_approx++;
        needs_review.push({
          index: i,
          reason: `posible_duplicado_ventana_solapada: coincide con payment id=${existingApprox.id} por patient_id+fecha_hora+monto_ars (clave_unica="${rec.clave_unica}")`,
          record: rec,
        });
        continue;
      }
    }

    // ── 5.10 Insert en DB ─────────────────────────────────────────────────────
    // external_id y notes ya existen en la tabla payments (verificado en DB).
    const insertPayload: Record<string, unknown> = {
      patient_id: patientId,
      professional_profile_id: professionalId,
      amount_ars: montoRaw,
      amount_usd: null,
      currency: "ARS",
      payment_method: medioPagoNorm,
      commission_amount_ars: 0,   // siempre 0 hasta que se cablee commission_rates
      payment_date: parsedDate.toISOString(),
      appointment_id: null,
      order_id: null,
      external_id: rec.clave_unica,
      notes: rec.servicio ?? null,
    };

    const { error: insertError } = await supabaseAdmin
      .from("payments")
      .insert(insertPayload);

    if (insertError) {
      rejected.push({ index: i, reason: insertError.message, record: rec });
      continue;
    }

    inserted++;

    // Multi-servicio: registrar en needs_review para revisión manual
    // (el pago ya fue insertado; esto es advertencia sobre cobro insertado)
    if (isMultiService) {
      inserted_with_warnings++;
      needs_review.push({
        index: i,
        reason: `is_multi_service: servicio contiene múltiples tratamientos — verificar si debe dividirse en pagos separados (servicio="${rec.servicio}")`,
        record: rec,
      });
    }
  }

  // ── 6. Persistir items en ingest_review (idempotente) ─────────────────────
  if (needs_review.length > 0) {
    await persistReviewItems(
      needs_review.map((item) => ({
        source: "payments",
        record_identifier: item.record.clave_unica || item.record.dni || null,
        reason: item.reason,
        payload: item.record as unknown as Record<string, unknown>,
      }))
    );
  }

  // ── 7. Respuesta estandarizada reconciliada ──────────────────────────────
  const reconciliationCheck =
    inserted +
    skipped_estado +
    duplicates_exact +
    duplicates_approx +
    needs_review_uninserted +
    rejected.length ===
    records.length;

  return NextResponse.json({
    success: true,
    summary: {
      total_received: records.length,
      inserted,
      inserted_with_warnings,
      skipped_estado,
      duplicates_exact,
      duplicates_approx,
      needs_review_uninserted,
      needs_review: needs_review.length,
      rejected: rejected.length,
      reconciliation_check: reconciliationCheck,
    },
    needs_review_detail: needs_review,
    rejected_detail: rejected,
  });
}
