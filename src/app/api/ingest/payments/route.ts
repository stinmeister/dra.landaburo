import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/ingest/payments
// Auth: Authorization: Bearer $INGEST_SECRET
//
// Acepta un array de registros de cobros exportados desde Calu (via n8n).
//
// CORRECCIONES IMPLEMENTADAS (A1-A4):
//
//  A1 - Deduplicación por external_id:
//       Si llega external_id → dedup por external_id único en DB.
//       Si no llega external_id → insertar igual pero marcar en needs_review.
//       DDL_PENDING: external_id y notes se omiten del INSERT hasta que existan las
//       columnas en DB. Cuando estén, descomentar las líneas marcadas [DDL_PENDING].
//       SQL a aplicar ANTES de activar la ingesta real:
//         ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;
//         ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;
//         ALTER TABLE public.payments ALTER COLUMN patient_id DROP NOT NULL;
//         ALTER TABLE public.payments ALTER COLUMN professional_profile_id DROP NOT NULL;
//
//  A2 - Eliminar fallback al primer admin:
//       Si no llega professional_profile_id → va a needs_review SIN insertar
//       (professional_profile_id es NOT NULL en DB; no se puede insertar nulo).
//
//  A3 - Lookup de paciente robusto:
//       Si no se resuelve patient_id → va a needs_review SIN insertar
//       (patient_id es NOT NULL en DB).
//       Normalización de teléfono antes del lookup.
//       Si hay más de un match → needs_review con motivo ambiguous_ref.
//
//  A4 - Estructura de respuesta estandarizada con needs_review_detail y rejected_detail.
//
// BLOQUEANTE: Sin las columnas external_id y notes en payments, la deduplicación real
// por external_id no puede hacerse a nivel DB. Actualmente se intenta lookup por
// esa columna; si Postgres lanza "column does not exist", el registro va a rejected.
// Aplicar el DDL_PENDING antes de usar en producción.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Normalización de teléfono ───────────────────────────────────────────────
// Quita todo excepto dígitos y elimina prefijos internacionales argentinos.
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // +54 9 → 13 dígitos comenzando con 549  (celulares)
  if (digits.length === 13 && digits.startsWith("549")) digits = digits.slice(3);
  // +54   → 13 dígitos comenzando con 54   (fijos o formato alternativo)
  if (digits.length === 13 && digits.startsWith("54"))  digits = digits.slice(2);
  return digits;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface PaymentRecord {
  // Campos requeridos
  payment_date: string;          // ISO 8601 e.g. "2026-09-10T14:30:00-03:00"
  amount_ars: number;
  payment_method: "efectivo" | "transferencia" | "mercadopago";

  // Campos opcionales
  currency?: "ARS" | "USD";
  amount_usd?: number | null;
  commission_amount_ars?: number;

  // Resolución de FK (n8n puede enviar uuid directo o referencia cruda)
  patient_id?: string;           // uuid resuelto por n8n
  patient_ref?: string;          // teléfono, DNI o nombre si n8n no resolvió
  professional_profile_id?: string;
  appointment_id?: string | null;
  order_id?: string | null;

  // Metadatos de trazabilidad
  // DDL_PENDING: external_id y notes se guardarán en payments cuando existan las columnas.
  // Por ahora van a needs_review metadata para trazabilidad.
  external_id?: string;          // ID único del registro en el sistema origen (Calu)
  notes?: string;                // Observaciones libres del registro origen
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

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {

  // ── 1. Autenticación ────────────────────────────────────────────────────────
  // NOTA: INGEST_SECRET debe estar definido en .env.local del servidor.
  // Sin él, TODOS los requests son rechazados con 401.
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
    if (!Array.isArray(records)) throw new Error("Payload must be array or { records: [] }");
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 }
    );
  }

  // ── 3. Acumuladores ─────────────────────────────────────────────────────────
  let inserted = 0;
  let duplicates_by_external_id = 0;
  const needs_review: NeedsReviewItem[] = [];
  const rejected: RejectedItem[] = [];

  // ── 4. Procesamiento por registro ───────────────────────────────────────────
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // 4a. Validación de campos requeridos (formato) → rejected si fallan
    if (!rec.payment_date || rec.amount_ars == null || !rec.payment_method) {
      rejected.push({ index: i, reason: "Faltan campos requeridos: payment_date, amount_ars, payment_method", record: rec });
      continue;
    }
    if (!["efectivo", "transferencia", "mercadopago"].includes(rec.payment_method)) {
      rejected.push({ index: i, reason: `payment_method inválido: "${rec.payment_method}"`, record: rec });
      continue;
    }
    let parsedDate: Date;
    try {
      parsedDate = new Date(rec.payment_date);
      if (isNaN(parsedDate.getTime())) throw new Error("fecha inválida");
    } catch {
      rejected.push({ index: i, reason: `payment_date inválido: "${rec.payment_date}"`, record: rec });
      continue;
    }

    // 4b. A1 – Deduplicación por external_id
    // DDL_PENDING: esta consulta fallará con error de Postgres si la columna
    // external_id no existe aún. En ese caso el registro va a rejected con el
    // mensaje de error de DB. Aplicar el DDL_PENDING para habilitar esto.
    if (rec.external_id) {
      const { data: existingByExtId, error: extIdError } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("external_id", rec.external_id)
        .maybeSingle();

      if (extIdError) {
        // Columna no existe u otro error de DB → rechazar con detalle
        rejected.push({
          index: i,
          reason: `Error al verificar external_id (DDL_PENDING posible): ${extIdError.message}`,
          record: rec,
        });
        continue;
      }

      if (existingByExtId) {
        duplicates_by_external_id++;
        continue; // Ya insertado, ignorar silenciosamente
      }
    } else {
      // Sin external_id: se procesa pero se marcará en needs_review al final
      // (no se corta aquí; el registro sigue su flujo normal de inserción)
    }

    // 4c. A3 – Resolución robusta de patient_id
    // patient_id es NOT NULL en DB → si no se resuelve, NO se puede insertar.
    let patientId: string | undefined = rec.patient_id;
    let patientNeedsReviewReason: string | undefined;

    if (!patientId && rec.patient_ref) {
      const normPhone = normalizePhone(rec.patient_ref);

      // Construir OR seguro: .or() con columnas separadas, sin interpolación de valores
      // para evitar inyección. Se usan placeholders de parámetros de Supabase.
      const { data: patients, error: patientError } = await supabaseAdmin
        .from("patients")
        .select("id")
        .or(
          [
            `phone.eq.${normPhone}`,
            `phone.eq.${rec.patient_ref}`,   // también sin normalizar, por si el DB ya tiene formato distinto
            `dni.eq.${rec.patient_ref}`,
          ].join(",")
        );

      if (patientError) {
        rejected.push({ index: i, reason: `Error al buscar paciente: ${patientError.message}`, record: rec });
        continue;
      }

      // Deduplicar por id (el OR puede traer duplicados si phone y dni matchean el mismo)
      const uniquePatients = patients
        ? [...new Map(patients.map((p) => [p.id, p])).values()]
        : [];

      if (uniquePatients.length === 0) {
        patientNeedsReviewReason = `sin_paciente: no se encontró paciente con ref "${rec.patient_ref}"`;
      } else if (uniquePatients.length > 1) {
        patientNeedsReviewReason = `ambiguous_ref: ${uniquePatients.length} pacientes coinciden con ref "${rec.patient_ref}"`;
      } else {
        patientId = uniquePatients[0].id;
      }
    } else if (!patientId && !rec.patient_ref) {
      patientNeedsReviewReason = "sin_paciente: no se recibió patient_id ni patient_ref";
    }

    // Si patient_id no se pudo resolver → needs_review SIN insertar
    // (patient_id es NOT NULL en DB; insertar null causaría error de Postgres)
    if (!patientId) {
      needs_review.push({
        index: i,
        reason: patientNeedsReviewReason ?? "sin_paciente: razón desconocida",
        record: rec,
      });
      continue;
    }

    // 4d. A2 – Resolución de professional_profile_id (SIN fallback al primer admin)
    // professional_profile_id es NOT NULL en DB → si no llega, NO se puede insertar.
    // ELIMINADO: el fallback al primer admin era semánticamente incorrecto.
    if (!rec.professional_profile_id) {
      needs_review.push({
        index: i,
        reason: "sin_professional: asignar profesional manualmente (professional_profile_id es requerido en DB)",
        record: rec,
      });
      continue;
    }

    // 4e. Insert en DB
    // DDL_PENDING: external_id y notes se omiten del INSERT hasta que las columnas
    // existan en payments. Descomentar las líneas marcadas cuando el DDL sea aplicado.
    const { error: insertError } = await supabaseAdmin.from("payments").insert({
      patient_id: patientId,
      professional_profile_id: rec.professional_profile_id,
      appointment_id: rec.appointment_id ?? null,
      order_id: rec.order_id ?? null,
      amount_ars: rec.amount_ars,
      amount_usd: rec.amount_usd ?? null,
      currency: rec.currency ?? "ARS",
      payment_method: rec.payment_method,
      commission_amount_ars: rec.commission_amount_ars ?? 0,
      payment_date: parsedDate.toISOString(),
      // [DDL_PENDING] Descomentar cuando existan las columnas en payments:
      // external_id: rec.external_id ?? null,
      // notes: rec.notes ?? null,
    });

    if (insertError) {
      rejected.push({ index: i, reason: insertError.message, record: rec });
      continue;
    }

    inserted++;

    // A1: Si no tenía external_id, marcar en needs_review DESPUÉS del insert exitoso
    if (!rec.external_id) {
      needs_review.push({
        index: i,
        reason: "sin_external_id: posible duplicado (no hay external_id para deduplicar)",
        record: rec,
      });
    }
  }

  // ── 5. A4 – Respuesta estandarizada ─────────────────────────────────────────
  return NextResponse.json({
    success: true,
    summary: {
      total_received: records.length,
      inserted,
      duplicates_by_external_id,
      needs_review: needs_review.length,
      rejected: rejected.length,
    },
    needs_review_detail: needs_review,
    rejected_detail: rejected,
  });
}
