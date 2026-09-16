import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistReviewItems } from "@/lib/ingest-review";

// POST /api/ingest/payments
// Auth: Authorization: Bearer $INGEST_SECRET
//
// Acepta un array de registros de cobros exportados desde la hoja Citas_Raw
// (Base Unificada v2) procesados por n8n.
//
// Reglas y Filtros Aplicados:
//  1. Regla de corte: Ignora cobros anteriores a PAYMENTS_CUTOFF_DATE (default: 2026-08-01).
//  2. Filtrado por Estado:
//     - Facturable: 'Finalizado'.
//     - Descarte silencioso: 'Cancelado', 'Ausente', 'Programado', 'Confirmado',
//       'En sala de espera', 'En curso', 'Cita Eliminada por...'.
//     - Estados desconocidos van a needs_review ('estado_desconocido').
//  3. Deduplicación doble: exacta por clave_unica (external_id) y por ventana solapada.
//  4. Detección de moneda por rango de monto (sin heurísticas por nombre de servicio):
//     - < $2.000: Dólares (USD) -> needs_review ('moneda_usd') para conversión/confirmación.
//     - $2.000 a $30.000: Rango ambiguo -> needs_review ('monto_rango_ambiguo').
//     - >= $30.000: Pesos (ARS), incluso si medio_pago dice 'Efectivo USD'.
//  5. Multi-servicio: Se detecta contra catálogo (no por comas en nombres compuestos como
//     'Lp Rostro, Cuello Y Escote'). Los multi-servicios reales ingresan a payments normalmente
//     y ya no generan registro de revisión.
//  6. Medios de pago: Mapeo exhaustivo sincronizado con el constraint de Postgres.
//  7. Normalización de DNI y Hashes alfanuméricos de Calu.
//  8. Asignación de profesionales dinámico con respaldo estático.

// ─── Supabase admin ───────────────────────────────────────────────────────────

const supabaseAdmin = createAdminClient();

// ─── Configuraciones y Umbrales ───────────────────────────────────────────────

function getCutoffDate(): Date {
  const envVal = process.env.PAYMENTS_CUTOFF_DATE || "2026-08-01T00:00:00-03:00";
  const dt = new Date(envVal);
  return isNaN(dt.getTime()) ? new Date("2026-08-01T00:00:00-03:00") : dt;
}

function getCurrencyThresholds() {
  const usdMax = Number(process.env.INGEST_USD_MAX_THRESHOLD || 2000);
  const arsMin = Number(process.env.INGEST_ARS_MIN_THRESHOLD || 30000);
  return {
    usdMax: isNaN(usdMax) ? 2000 : usdMax,
    arsMin: isNaN(arsMin) ? 30000 : arsMin,
  };
}

// ─── Constantes de estado ─────────────────────────────────────────────────────

const ESTADOS_FACTURABLES = new Set(["finalizado"]);

const ESTADOS_IGNORAR_BASE = new Set([
  "programado",
  "confirmado",
  "cancelado",
  "ausente",
  "en sala de espera",
  "en curso",
]);

function shouldIgnoreEstado(rawEstado: string): boolean {
  if (!rawEstado) return false;
  const norm = rawEstado.toLowerCase().trim();
  if (ESTADOS_IGNORAR_BASE.has(norm)) return true;
  // C1: Cita eliminada por cualquier usuario se descarta en silencio
  if (norm.startsWith("cita eliminada")) return true;
  return false;
}

// ─── Mapa de medios de pago ───────────────────────────────────────────────────

const PAYMENT_METHOD_MAP: Record<string, string> = {
  efectivo: "efectivo",
  transferencia: "transferencia",
  mercadopago: "mercadopago",
  "mercado pago": "mercadopago",
  mp: "mercadopago",
  "tarjeta de debito": "tarjeta_debito",
  "tarjeta de débito": "tarjeta_debito",
  debito: "tarjeta_debito",
  débito: "tarjeta_debito",
  tarjeta_debito: "tarjeta_debito",
  "tarjeta de credito": "tarjeta_credito",
  "tarjeta de crédito": "tarjeta_credito",
  credito: "tarjeta_credito",
  crédito: "tarjeta_credito",
  tarjeta_credito: "tarjeta_credito",
  "efectivo usd": "efectivo_usd",
  usd: "efectivo_usd",
  dolar: "efectivo_usd",
  dólar: "efectivo_usd",
  cheque: "cheque",
};

function normalizePaymentMethod(raw: string): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return PAYMENT_METHOD_MAP[key] || null;
}

// ─── Catálogo de tratamientos únicos que contienen coma ───────────────────────

const KNOWN_SINGLE_TREATMENTS_WITH_COMMAS = new Set([
  "lp rostro, cuello y escote",
  "lp rostro, cuello y escote, frax",
  "limpieza + electroporación/radio/peeling/dermapen",
  "limpieza + electroporacion/radio/peeling/dermapen",
]);

function isRealMultiService(servicioRaw: string): boolean {
  if (!servicioRaw || !servicioRaw.includes(",")) return false;
  const lower = servicioRaw.toLowerCase().trim();
  if (KNOWN_SINGLE_TREATMENTS_WITH_COMMAS.has(lower)) return false;
  return true;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PaymentRecord {
  clave_unica: string;
  dni: string;
  fecha: string;
  servicio: string;
  estado: string;
  monto_pagado_ars: number;
  deuda_ars: number;
  medio_pago: string;
  profesional: string;
  archivo_origen?: string;
  telefono?: string;

  patient_id?: string;
  professional_profile_id?: string;
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

interface ParsedPaymentDate {
  date: Date;
  hasSpecificTime: boolean;
}

/**
 * Parsea fecha y hora completas.
 * Prioridad 1: Clave_Unica (DNI|YYYY-MM-DDTHH:mm:ss|Servicio o YYYYMMDD_HHmmss_DNI)
 * Prioridad 2: Columna fecha en formato D/M/YYYY HH:mm:ss o D/M/YYYY
 * Zona horaria Argentina (-03:00).
 */
function parsePaymentDate(claveUnica: string | undefined, fechaRaw: string | undefined): ParsedPaymentDate | null {
  if (claveUnica) {
    if (claveUnica.includes("|")) {
      const parts = claveUnica.split("|");
      if (parts.length >= 2) {
        const tsPart = parts[1].trim();
        if (tsPart.includes("T") || tsPart.match(/^\d{4}-\d{2}-\d{2}/)) {
          const hasTz = tsPart.endsWith("Z") || tsPart.includes("+") || tsPart.slice(10).includes("-");
          const withTz = hasTz ? tsPart : `${tsPart}-03:00`;
          const dt = new Date(withTz);
          if (!isNaN(dt.getTime())) {
            const hasTime = tsPart.includes("T") && !tsPart.includes("T00:00:00");
            return { date: dt, hasSpecificTime: hasTime };
          }
        }
      }
    }

    const underMatch = claveUnica.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (underMatch) {
      const [, y, mo, d, h, min, s] = underMatch;
      const dt = new Date(`${y}-${mo}-${d}T${h}:${min}:${s}-03:00`);
      if (!isNaN(dt.getTime())) {
        return { date: dt, hasSpecificTime: true };
      }
    }
  }

  if (fechaRaw) {
    const rawTrimmed = fechaRaw.trim();
    const parts = rawTrimmed.split(" ");
    const dateParts = parts[0].split("/");
    if (dateParts.length === 3) {
      const [d, m, y] = dateParts;
      if (parts[1]) {
        const timeSub = parts[1].split(":");
        const timePart = timeSub.length === 2 ? `${parts[1]}:00` : parts[1];
        const dt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${timePart}-03:00`);
        if (!isNaN(dt.getTime())) return { date: dt, hasSpecificTime: true };
      } else {
        const dt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00-03:00`);
        if (!isNaN(dt.getTime())) return { date: dt, hasSpecificTime: false };
      }
    }
  }

  return null;
}

function normalizeDni(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function isAlphanumericHash(raw: string): boolean {
  const trimmed = (raw || "").trim();
  return /[a-zA-Z]/.test(trimmed) && trimmed.length >= 7;
}

/**
 * Lookup de paciente por DNI, Hash o Teléfono.
 */
async function resolvePatient(
  rawDni: string,
  rawPhone?: string
): Promise<{ id: string } | "ambiguous" | null> {
  const trimmed = (rawDni || "").trim();
  if (!trimmed) return null;

  if (isAlphanumericHash(trimmed)) {
    // Buscar directamente por el hash exacto (sin eliminar letras)
    const { data, error } = await supabaseAdmin
      .from("patients")
      .select("id")
      .ilike("dni", trimmed);

    if (!error && data && data.length === 1) return data[0];
    if (data && data.length > 1) return "ambiguous";
  } else {
    // DNI numérico tradicional
    const normDni = normalizeDni(trimmed);
    if (normDni && normDni.length >= 6) {
      const { data, error } = await supabaseAdmin
        .from("patients")
        .select("id")
        .eq("dni", normDni);

      if (!error && data && data.length === 1) return data[0];
      if (data && data.length > 1) return "ambiguous";
    }
  }

  // Búsqueda alternativa por teléfono si existe
  if (rawPhone && rawPhone.trim().length >= 6) {
    const cleanPhone = rawPhone.replace(/[^0-9+]/g, "");
    const { data: phoneMatches } = await supabaseAdmin
      .from("patients")
      .select("id")
      .ilike("phone", `%${cleanPhone.slice(-8)}%`);

    if (phoneMatches && phoneMatches.length === 1) return phoneMatches[0];
  }

  return null;
}

// ─── Mapa de profesionales ────────────────────────────────────────────────────

const STATIC_PROFESSIONAL_MAP: Record<string, string> = {
  // Dra. Paula Natalia Landaburo
  "landaburo, natalia": "ed7a0c98-3333-4f08-8c44-09b8587652bd",
  "landaburo, paula": "ed7a0c98-3333-4f08-8c44-09b8587652bd",
  "paula natalia landaburo": "ed7a0c98-3333-4f08-8c44-09b8587652bd",
  "paula landaburo": "ed7a0c98-3333-4f08-8c44-09b8587652bd",
  "natalia landaburo": "ed7a0c98-3333-4f08-8c44-09b8587652bd",
  "dra. landaburo": "ed7a0c98-3333-4f08-8c44-09b8587652bd",
  "dra landaburo": "ed7a0c98-3333-4f08-8c44-09b8587652bd",
  "dra paula landaburo": "ed7a0c98-3333-4f08-8c44-09b8587652bd",
  "dra. paula landaburo": "ed7a0c98-3333-4f08-8c44-09b8587652bd",

  // Mercedes Pasquet (Cosmetología)
  "pasquet, mercedes": "11123745-1a5a-428c-9bed-29de4355d59c",
  "mercedes pasquet": "11123745-1a5a-428c-9bed-29de4355d59c",
  "mechi pasquet": "11123745-1a5a-428c-9bed-29de4355d59c",
  "pasquet mercedes": "11123745-1a5a-428c-9bed-29de4355d59c",
  "pasquet": "11123745-1a5a-428c-9bed-29de4355d59c",
};

async function getProfesionalMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  try {
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["admin", "medico", "cosmetologa"]);

    if (!error && profiles) {
      for (const p of profiles) {
        if (!p.full_name || !p.id) continue;
        const nameLower = p.full_name.toLowerCase();

        map.set(p.full_name, p.id);
        map.set(nameLower, p.id);

        if (nameLower.includes("natalia") || nameLower.includes("paula")) {
          map.set("Landaburo, Natalia", p.id);
          map.set("landaburo, natalia", p.id);
          map.set("Landaburo, Paula", p.id);
          map.set("landaburo, paula", p.id);
          map.set("Dra. Landaburo", p.id);
          map.set("dra. landaburo", p.id);
          map.set("Dra Landaburo", p.id);
          map.set("dra landaburo", p.id);
        }
        if (nameLower.includes("pasquet") || nameLower.includes("mercedes")) {
          map.set("Pasquet, Mercedes", p.id);
          map.set("pasquet, mercedes", p.id);
          map.set("Mercedes Pasquet", p.id);
          map.set("mercedes pasquet", p.id);
          map.set("Mechi Pasquet", p.id);
          map.set("mechi pasquet", p.id);
        }
      }
    }
  } catch (err) {
    console.warn("[ingest_payments] Excepción al consultar profiles:", err);
  }

  return map;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Autenticación ────────────────────────────────────────────────────────
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

  // ── 3. Carga de mapa de profesionales y corte ──────────────────────────────
  const profesionalMap = await getProfesionalMap();
  const cutoffDate = getCutoffDate();
  const { usdMax, arsMin } = getCurrencyThresholds();

  // ── 4. Acumuladores ─────────────────────────────────────────────────────────
  let inserted = 0;
  let updated = 0;
  let skipped_estado = 0;
  let skipped_fuera_de_rango = 0;
  let duplicates_exact = 0;
  let duplicates_approx = 0;
  let needs_review_uninserted = 0;
  const needs_review: NeedsReviewItem[] = [];
  const rejected: RejectedItem[] = [];

  // ── 5. Procesamiento por registro ───────────────────────────────────────────
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // ── 5.1 Validación mínima de campos requeridos ────────────────────────────
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

    // ── 5.2 Parseo y Filtro de Fecha de Corte (Regla A) ──────────────────────
    const dateParseResult = parsePaymentDate(rec.clave_unica, rec.fecha);
    if (!dateParseResult) {
      rejected.push({
        index: i,
        reason: `fecha inválida: "${rec.fecha}" (o clave_unica "${rec.clave_unica}") — se espera formato D/M/YYYY o timestamp ISO`,
        record: rec,
      });
      continue;
    }
    const { date: parsedDate, hasSpecificTime } = dateParseResult;

    if (parsedDate < cutoffDate) {
      skipped_fuera_de_rango++;
      continue;
    }

    // ── 5.3 Búsqueda Nivel 1 (por external_id / clave_unica) ─────────────────
    let existingByExtId: {
      id: string;
      amount_ars: number | null;
      amount_usd: number | null;
      currency: string | null;
      payment_method: string | null;
      notes: string | null;
    } | null = null;

    {
      const { data: existingData, error: extIdError } = await supabaseAdmin
        .from("payments")
        .select("id, amount_ars, amount_usd, currency, payment_method, notes")
        .eq("external_id", rec.clave_unica)
        .maybeSingle();

      if (extIdError) {
        const isDdlPending =
          extIdError.message.includes("column") ||
          extIdError.message.includes("does not exist") ||
          extIdError.code === "42703";

        if (!isDdlPending) {
          rejected.push({
            index: i,
            reason: `Error al verificar external_id: ${extIdError.message}`,
            record: rec,
          });
          continue;
        }
      } else if (existingData) {
        existingByExtId = existingData;
      }
    }

    // ── 5.4 Filtrado por Estado (Reglas C1 y C2) ─────────────────────────────
    const estadoRaw = rec.estado.trim();
    const estadoLower = estadoRaw.toLowerCase();

    if (!ESTADOS_FACTURABLES.has(estadoLower)) {
      if (shouldIgnoreEstado(estadoRaw)) {
        // Caso Inverso: ¿Estaba previamente registrado con dinero en DB?
        if (
          existingByExtId &&
          (Number(existingByExtId.amount_ars ?? 0) > 0 || Number(existingByExtId.amount_usd ?? 0) > 0)
        ) {
          needs_review_uninserted++;
          needs_review.push({
            index: i,
            reason: `posible_anulacion: Turno previamente registrado con $${Number(existingByExtId.amount_ars ?? 0).toLocaleString("es-AR")} ahora figura como "${estadoRaw}". Verificar si corresponde anular el cobro o si fue un error en Calu.`,
            record: rec,
          });
          continue;
        }

        // Cita cancelada, ausente, en sala de espera, eliminada o futura sin cobro -> silencio
        skipped_estado++;
        continue;
      }

      // Estado desconocido no contemplado -> a revisión
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `estado_desconocido: Estado "${estadoRaw}" no es facturable ni ignorable`,
        record: rec,
      });
      continue;
    }

    // ── 5.5 Detección de Moneda por Rango de Monto (Regla C3) ─────────────────
    const montoRaw = rec.monto_pagado_ars;
    const medioPagoKey = (rec.medio_pago || "").toLowerCase().trim();
    const isLabeledUSD =
      medioPagoKey.includes("usd") ||
      medioPagoKey.includes("dolar") ||
      medioPagoKey.includes("dólar");

    if (montoRaw < 0) {
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `monto_negativo: Monto negativo (${montoRaw}) en registro de origen`,
        record: rec,
      });
      continue;
    }

    let detectedCurrency: "ARS" | "USD" = "ARS";
    let effectiveMedioPago = normalizePaymentMethod(rec.medio_pago) || "efectivo";

    if (montoRaw > 0 && montoRaw < usdMax) {
      // Menor a $2.000 -> Dólares (USD)
      detectedCurrency = "USD";
      effectiveMedioPago = "efectivo_usd";
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `moneda_usd: Cobro parece estar en dólares (monto = ${montoRaw} USD, medio de pago = "${rec.medio_pago}"). Requiere cotización o confirmación.`,
        record: rec,
      });
      continue;
    } else if (montoRaw >= usdMax && montoRaw < arsMin) {
      // Entre $2.000 y $30.000 -> Rango ambiguo
      detectedCurrency = isLabeledUSD ? "USD" : "ARS";
      needs_review_uninserted++;
      needs_review.push({
        index: i,
        reason: `monto_rango_ambiguo: Monto ${montoRaw} está fuera del rango habitual ($${usdMax.toLocaleString("es-AR")} a $${arsMin.toLocaleString("es-AR")}). Verificar si es saldo en pesos o cobro en USD.`,
        record: rec,
      });
      continue;
    } else {
      // $30.000 o más -> Pesos (ARS), incluso si dice Efectivo USD (error de tipeo en planilla)
      detectedCurrency = "ARS";
      if (isLabeledUSD) {
        effectiveMedioPago = "efectivo";
      }
    }

    // ── 5.6 Normalización de Medio de Pago (Regla C5) ─────────────────────────
    if (!effectiveMedioPago) {
      effectiveMedioPago = "efectivo";
    }

    // ── 5.6.1 Si ya existía por external_id, comparar y actualizar (Regla A) ──
    if (existingByExtId) {
      const oldAmountArs = Number(existingByExtId.amount_ars ?? 0);
      const newAmountArs = montoRaw;
      const oldAmountUsd = existingByExtId.amount_usd != null ? Number(existingByExtId.amount_usd) : null;
      const newAmountUsd: number | null = null;
      const oldPaymentMethod = existingByExtId.payment_method;
      const newPaymentMethod = effectiveMedioPago;

      const amountChanged = oldAmountArs !== newAmountArs || oldAmountUsd !== newAmountUsd;
      const methodChanged = oldPaymentMethod !== newPaymentMethod;
      const currencyChanged = existingByExtId.currency !== detectedCurrency;

      if (!amountChanged && !methodChanged && !currencyChanged) {
        // Registro idéntico sin cambios relevantes
        duplicates_exact++;
        continue;
      }

      // ── Hubo cambios: ACTUALIZAR registro existente en payments ──
      const currentNotes = existingByExtId.notes || "";
      const changeAudit = amountChanged
        ? ` [Actualizado: antes $${oldAmountArs.toLocaleString("es-AR")}]`
        : ` [Medio pago: ${oldPaymentMethod} -> ${newPaymentMethod}]`;

      const updatedNotes = currentNotes.includes("[Actualizado")
        ? `${currentNotes};${changeAudit}`
        : `${currentNotes || rec.servicio || ""}${changeAudit}`;

      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update({
          amount_ars: newAmountArs,
          amount_usd: newAmountUsd,
          currency: detectedCurrency,
          payment_method: newPaymentMethod,
          notes: updatedNotes,
        })
        .eq("id", existingByExtId.id);

      if (updateError) {
        rejected.push({
          index: i,
          reason: `Error al actualizar cobro existente: ${updateError.message}`,
          record: rec,
        });
        continue;
      }

      // Dejar constancia en ingest_review si cambió el monto
      if (amountChanged) {
        await supabaseAdmin.from("ingest_review").insert({
          source: "payments",
          record_identifier: rec.clave_unica,
          reason: `monto_actualizado: Cobro modificado de $${oldAmountArs.toLocaleString("es-AR")} a $${newAmountArs.toLocaleString("es-AR")} (${newPaymentMethod})`,
          payload: {
            clave_unica: rec.clave_unica,
            dni: rec.dni,
            fecha: rec.fecha,
            monto_anterior_ars: oldAmountArs,
            monto_nuevo_ars: newAmountArs,
            medio_pago_anterior: oldPaymentMethod,
            medio_pago_nuevo: newPaymentMethod,
            servicio: rec.servicio,
            payment_id: existingByExtId.id,
          },
          status: "resolved",
          resolution_notes: `Actualización automática durante ingesta: cambio de monto de $${oldAmountArs} a $${newAmountArs}`,
          resolved_by: "system_ingest",
          resolved_at: new Date().toISOString(),
        });
      }

      updated++;
      continue;
    }

    // ── 5.7 Resolución de Paciente (Regla C6) ─────────────────────────────────
    let patientId: string | undefined = rec.patient_id;

    if (!patientId) {
      const lookupResult = await resolvePatient(rec.dni, rec.telefono);
      if (lookupResult === "ambiguous") {
        needs_review_uninserted++;
        needs_review.push({
          index: i,
          reason: `ambiguous_ref: Múltiples pacientes coinciden con el identificador "${rec.dni}"`,
          record: rec,
        });
        continue;
      }
      if (!lookupResult) {
        needs_review_uninserted++;
        needs_review.push({
          index: i,
          reason: `sin_paciente: No se encontró paciente registrada con DNI/identificador "${rec.dni}"`,
          record: rec,
        });
        continue;
      }
      patientId = lookupResult.id;
    }

    // ── 5.8 Resolución de Profesional (Regla C6) ──────────────────────────────
    let professionalId: string | undefined = rec.professional_profile_id;

    if (!professionalId) {
      const rawProf = (rec.profesional ?? "").trim();
      if (!rawProf) {
        needs_review_uninserted++;
        needs_review.push({
          index: i,
          reason: `sin_professional: Falta asignar la profesional en la planilla de origen`,
          record: rec,
        });
        continue;
      }

      const normProf = rawProf.toLowerCase();
      let mapped =
        profesionalMap.get(rawProf) ||
        profesionalMap.get(normProf);

      if (!mapped && STATIC_PROFESSIONAL_MAP[normProf]) {
        mapped = STATIC_PROFESSIONAL_MAP[normProf];
      }

      if (!mapped) {
        needs_review_uninserted++;
        needs_review.push({
          index: i,
          reason: `sin_professional: Profesional "${rawProf}" no encontrada en perfiles (asignar manualmente)`,
          record: rec,
        });
        continue;
      }
      professionalId = mapped;
    }

    // ── 5.9 Deduplicación Nivel 2 (ventana solapada) ──────────────────────────
    {
      const winStart = hasSpecificTime
        ? new Date(parsedDate.getTime() - 15 * 60 * 1000)
        : new Date(parsedDate.getTime());

      const winEnd = hasSpecificTime
        ? new Date(parsedDate.getTime() + 15 * 60 * 1000)
        : new Date(parsedDate.getTime() + 24 * 60 * 60 * 1000 - 1);

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
          reason: `posible_duplicado_ventana_solapada: Coincide con cobro ID=${existingApprox.id} por paciente+fecha+monto (${rec.clave_unica})`,
          record: rec,
        });
        continue;
      }
    }

    // ── 5.10 Multi-servicio y Guardado en DB (Regla C4) ───────────────────────
    const isMulti = isRealMultiService(rec.servicio ?? "");
    const paymentNotes = isMulti
      ? `[MULTI-SERVICIO] ${rec.servicio ?? ""}`
      : (rec.servicio ?? null);

    const insertPayload: Record<string, unknown> = {
      patient_id: patientId,
      professional_profile_id: professionalId,
      amount_ars: montoRaw,
      amount_usd: null,
      currency: "ARS",
      payment_method: effectiveMedioPago,
      commission_amount_ars: 0,
      payment_date: parsedDate.toISOString(),
      appointment_id: null,
      order_id: null,
      external_id: rec.clave_unica,
      notes: paymentNotes,
    };

    const { error: insertError } = await supabaseAdmin
      .from("payments")
      .insert(insertPayload);

    if (insertError) {
      rejected.push({ index: i, reason: insertError.message, record: rec });
      continue;
    }

    inserted++;
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

  // ── 7. Respuesta reconciliada ────────────────────────────────────────────
  const reconciliationCheck =
    inserted +
    updated +
    skipped_estado +
    skipped_fuera_de_rango +
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
      updated,
      skipped_estado,
      skipped_fuera_de_rango,
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
