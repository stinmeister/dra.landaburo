import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistReviewItems, type IngestReviewInput } from "@/lib/ingest-review";
import { loadProfessionals } from "@/lib/professionals";

// ─── Constantes y Restricciones de Base de Datos ─────────────────────────────

// CHECK en tabla payments: payment_method in ('efectivo','transferencia','mercadopago','tarjeta_debito','efectivo_usd','cheque')
const VALID_PAYMENT_METHODS = new Set([
  "efectivo",
  "transferencia",
  "mercadopago",
  "tarjeta_debito",
  "efectivo_usd",
  "cheque",
]);

// CHECK en tabla payments: movement_type in ('ingreso','egreso')
const VALID_MOVEMENT_TYPES = new Set(["ingreso", "egreso"]);

// ─── Normalización de Nombres de Pacientes ────────────────────────────────────

function normalizeName(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RawPaymentRow {
  external_key?: string;
  movement_type?: string;
  payment_date?: string;
  payer_name_raw?: string;
  description?: string;
  payment_method_raw?: string;
  payment_method?: string;
  origin_raw?: string;
  currency?: string;
  amount?: number;
  amount_ars?: number;
  amount_usd?: number;
  reclassified?: boolean;
  [key: string]: unknown;
}

interface IngestPayload {
  source?: string;
  source_file?: string;
  file_date?: string;
  rows?: RawPaymentRow[];
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth: Bearer token contra INGEST_SECRET o INGEST_SYNC_SECRET
  const ingestSecret = process.env.INGEST_SECRET || process.env.INGEST_SYNC_SECRET;
  if (!ingestSecret) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${ingestSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  // 2. Parseo de Body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as IngestPayload | RawPaymentRow[];
  const rows: RawPaymentRow[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rows)
    ? payload.rows
    : [];

  const source = (!Array.isArray(payload) && payload?.source) || "pagos";

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      rows_received: 0,
      rows_inserted: 0,
      rows_duplicated: 0,
      rows_in_review: 0,
      review_reasons: {},
    });
  }

  // 3. Reglas Fail-Closed previas al procesamiento
  // Regla 1: payment_date faltante o inválido rechaza la corrida completa con 400.
  // Regla: movement_type faltante rechaza la corrida completa con 400.
  // Regla: external_key faltante rechaza la corrida completa con 400.
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = r.external_key ? String(r.external_key).trim() : "";

    if (!key) {
      return NextResponse.json(
        { error: `Fila en índice ${i} sin external_key requerido` },
        { status: 400 }
      );
    }

    if (!r.movement_type || typeof r.movement_type !== "string" || !r.movement_type.trim()) {
      return NextResponse.json(
        { error: `Fila ${key} sin movement_type requerido (se rechaza con 400)` },
        { status: 400 }
      );
    }

    if (!r.payment_date || typeof r.payment_date !== "string" || !r.payment_date.trim()) {
      return NextResponse.json(
        { error: `Fila ${key} sin payment_date requerido (se rechaza con 400, no default)` },
        { status: 400 }
      );
    }

    const parsedDate = new Date(r.payment_date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: `Fila ${key} con payment_date inválido '${r.payment_date}'` },
        { status: 400 }
      );
    }
  }

  const supabaseAdmin = createAdminClient();

  // 4. Pre-carga de Identidades (Pacientes y Profesionales)
  // Pacientes: mapeo de nombres normalizados
  const { data: patientsData } = await supabaseAdmin
    .from("patients")
    .select("id, full_name");

  const patientMap = new Map<string, string>();
  for (const p of patientsData || []) {
    if (!p.full_name) continue;
    const norm = normalizeName(p.full_name);
    patientMap.set(norm, p.id);

    // Invertir si viene como "Apellido, Nombre"
    if (p.full_name.includes(",")) {
      const [last, first] = (p.full_name as string).split(",").map((s: string) => s.trim());
      if (last && first) {
        const inv = normalizeName(`${first} ${last}`);
        if (!patientMap.has(inv)) patientMap.set(inv, p.id);
      }
    }
  }

  // Profesionales: resolvedor flexible contra profiles
  const { resolveProfessional } = await loadProfessionals(supabaseAdmin);

  // 5. Procesamiento y Clasificación de Filas
  const paymentsToInsert: Record<string, unknown>[] = [];
  const reviewItemsToPersist: IngestReviewInput[] = [];
  const reviewReasons: Record<string, number> = {};
  let rowsDivertedToReview = 0;

  for (const row of rows) {
    const extId = String(row.external_key).trim();
    const movementType = String(row.movement_type).trim().toLowerCase();
    const rawMethod = (row.payment_method || "").trim().toLowerCase();
    const currency = (row.currency || "ARS").trim().toUpperCase();
    const amountNum = Number(row.amount);

    // 5.1 Validar movement_type contra CHECK
    if (!VALID_MOVEMENT_TYPES.has(movementType)) {
      reviewItemsToPersist.push({
        source: "payments",
        record_identifier: extId,
        reason: "movement_type_desconocido",
        payload: row as Record<string, unknown>,
      });
      reviewReasons["movement_type_desconocido"] =
        (reviewReasons["movement_type_desconocido"] || 0) + 1;
      rowsDivertedToReview++;
      continue;
    }

    // 5.2 Validar payment_method contra CHECK
    if (!VALID_PAYMENT_METHODS.has(rawMethod)) {
      reviewItemsToPersist.push({
        source: "payments",
        record_identifier: extId,
        reason: "medio_de_pago_no_mapeado",
        payload: row as Record<string, unknown>,
      });
      reviewReasons["medio_de_pago_no_mapeado"] =
        (reviewReasons["medio_de_pago_no_mapeado"] || 0) + 1;
      rowsDivertedToReview++;
      continue;
    }

    // 5.3 Mapeo de Moneda y Montos (Regla 3)
    let amountArs: number | null = null;
    let amountUsd: number | null = null;

    if (currency === "ARS") {
      amountArs = isNaN(amountNum) ? 0 : amountNum;
      amountUsd = null;
    } else if (currency === "USD") {
      amountArs = 0;
      amountUsd = isNaN(amountNum) ? 0 : amountNum;
    } else {
      // Moneda desconocida -> a revisión
      reviewItemsToPersist.push({
        source: "payments",
        record_identifier: extId,
        reason: "moneda_desconocida",
        payload: row as Record<string, unknown>,
      });
      reviewReasons["moneda_desconocida"] =
        (reviewReasons["moneda_desconocida"] || 0) + 1;
      rowsDivertedToReview++;
      continue;
    }

    // Si el payload contiene explícitamente amount_ars o amount_usd (ej: pruebas de coherencia), respetarlo
    if (row.amount_ars !== undefined) amountArs = Number(row.amount_ars);
    if (row.amount_usd !== undefined) amountUsd = Number(row.amount_usd);

    // 5.4 Reclasificación de Moneda (Auditable)
    if (row.reclassified === true) {
      reviewItemsToPersist.push({
        source: "payments",
        record_identifier: extId,
        reason: "moneda_reclasificada",
        payload: row as Record<string, unknown>,
      });
      reviewReasons["moneda_reclasificada"] =
        (reviewReasons["moneda_reclasificada"] || 0) + 1;
    }

    // 5.5 Resolución de Identidades (Regla 2: no bloquea si falla)
    const payerNameRaw = row.payer_name_raw ? String(row.payer_name_raw).trim() : null;
    let patientId: string | null = null;

    if (payerNameRaw) {
      const normPayer = normalizeName(payerNameRaw);
      patientId = patientMap.get(normPayer) || null;
      if (!patientId && payerNameRaw.includes(",")) {
        const [last, first] = payerNameRaw.split(",").map((s: string) => s.trim());
        if (last && first) {
          patientId = patientMap.get(normalizeName(`${first} ${last}`)) || null;
        }
      }
    }

    let professionalProfileId: string | null = null;
    if (row.origin_raw) {
      const prof = resolveProfessional(row.origin_raw);
      if (prof) professionalProfileId = prof.id;
    }

    // 5.6 Armar Fila de Cobro para Inserción
    paymentsToInsert.push({
      external_id: extId,
      movement_type: movementType,
      payment_date: new Date(row.payment_date!).toISOString(),
      payer_name: payerNameRaw,
      patient_id: patientId,
      professional_profile_id: professionalProfileId,
      notes: row.description ? String(row.description).trim() : null,
      payment_method: rawMethod,
      currency,
      amount_ars: amountArs,
      amount_usd: amountUsd,
      commission_amount_ars: 0,
      appointment_id: null,
      order_id: null,
    });
  }

  // 6. Persistencia Idempotente en payments (Regla 4: on conflict do nothing)
  let rowsInserted = 0;
  let rowsDuplicated = 0;

  if (paymentsToInsert.length > 0) {
    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from("payments")
      .upsert(paymentsToInsert, { onConflict: "external_id", ignoreDuplicates: true })
      .select("id, external_id");

    if (insertError) {
      console.error("[ingest/payments] Error en insert de payments:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    rowsInserted = insertedRows?.length ?? 0;
    rowsDuplicated = paymentsToInsert.length - rowsInserted;
  }

  // 7. Persistir ítems en ingest_review
  if (reviewItemsToPersist.length > 0) {
    await persistReviewItems(reviewItemsToPersist);
  }

  // 8. Respuesta con Contrato Oficial
  return NextResponse.json({
    rows_received: rows.length,
    rows_inserted: rowsInserted,
    rows_duplicated: rowsDuplicated,
    rows_in_review: rowsDivertedToReview,
    review_reasons: reviewReasons,
  });
}
