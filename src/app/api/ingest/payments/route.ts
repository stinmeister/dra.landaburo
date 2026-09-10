import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/ingest/payments
// Auth: Authorization: Bearer $INGEST_SECRET
//
// Acepta un array de registros de cobros exportados desde Calu (via n8n).
// Idempotente: usa (payment_date::date, patient_ref, amount_ars, payment_method) como
// clave de deduplicacion. Si ya existe un registro con esa clave, se ignora.
//
// BLOQUEANTE: el mapeo de columnas de origen (Calu) esta PENDIENTE hasta recibir un
// export de muestra real. Las columnas de destino (payments) estan definidas.
// Los campos marcados [CALU_PENDING] requieren mapeo manual cuando Agustin entregue el export.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Schema de payments (destino):
// id                    uuid PK (auto)
// patient_id            uuid FK -> patients.id  [CALU_PENDING: mapear por telefono o DNI]
// professional_profile_id uuid FK -> profiles.id [CALU_PENDING: mapear por nombre de profesional]
// appointment_id        uuid FK nullable         [CALU_PENDING: opcional, si Calu lo exporta]
// order_id              uuid FK nullable         [null para ingresos de Calu]
// amount_ars            numeric(12,2) NOT NULL
// amount_usd            numeric(12,2) nullable
// currency              text CHECK IN ("ARS","USD") default "ARS"
// payment_method        text CHECK IN ("efectivo","transferencia","mercadopago")
// commission_amount_ars numeric(12,2) default 0.00
// payment_date          timestamptz NOT NULL
// created_at            timestamptz auto

interface PaymentRecord {
  // Campos que n8n debe enviar (nombres de destino, mapeados desde Calu):
  payment_date: string;          // ISO 8601 e.g. "2026-09-10T14:30:00-03:00"
  amount_ars: number;            // ej: 95000
  payment_method: "efectivo" | "transferencia" | "mercadopago";
  currency?: "ARS" | "USD";
  amount_usd?: number | null;
  commission_amount_ars?: number;

  // Claves de lookup (n8n resuelve las FKs antes de enviar, o las pasa en raw):
  patient_id?: string;           // uuid si n8n lo resolvio
  patient_ref?: string;          // telefono o DNI si n8n no resolvio [CALU_PENDING]
  professional_profile_id?: string; // uuid si n8n lo resolvio [CALU_PENDING]
  appointment_id?: string | null;
  order_id?: string | null;

  // Metadatos opcionales para trazabilidad
  calu_id?: string;              // ID del registro en Calu [CALU_PENDING: nombre real del campo]
  notes?: string;
}

interface IngestResult {
  inserted: number;
  skipped_duplicates: number;
  rejected: { index: number; reason: string; record: PaymentRecord }[];
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get("authorization");
  const secret = process.env.INGEST_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let records: PaymentRecord[];
  try {
    const body = await req.json();
    records = Array.isArray(body) ? body : body.records;
    if (!Array.isArray(records)) throw new Error("Payload must be array or {records:[]}");
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 }
    );
  }

  const result: IngestResult = { inserted: 0, skipped_duplicates: 0, rejected: [] };

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // 2. Validate required fields
    if (!rec.payment_date || !rec.amount_ars || !rec.payment_method) {
      result.rejected.push({ index: i, reason: "Faltan campos requeridos: payment_date, amount_ars, payment_method", record: rec });
      continue;
    }
    if (!["efectivo", "transferencia", "mercadopago"].includes(rec.payment_method)) {
      result.rejected.push({ index: i, reason: `payment_method invalido: "${rec.payment_method}"`, record: rec });
      continue;
    }
    if (!rec.patient_id && !rec.patient_ref) {
      result.rejected.push({ index: i, reason: "Se requiere patient_id o patient_ref", record: rec });
      continue;
    }

    // 3. Resolve patient_id from patient_ref if needed
    let patientId = rec.patient_id;
    if (!patientId && rec.patient_ref) {
      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("id")
        .or(`phone.eq.${rec.patient_ref},dni.eq.${rec.patient_ref}`)
        .maybeSingle();
      if (!patient) {
        result.rejected.push({ index: i, reason: `Paciente no encontrado con ref: ${rec.patient_ref}`, record: rec });
        continue;
      }
      patientId = patient.id;
    }

    // 4. Resolve professional_profile_id (requerido por schema)
    // Si n8n no lo resuelve, usar un perfil por defecto (primer admin)
    let professionalId = rec.professional_profile_id;
    if (!professionalId) {
      const { data: adminProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      if (!adminProfile) {
        result.rejected.push({ index: i, reason: "No se puede resolver professional_profile_id: no hay admin en profiles", record: rec });
        continue;
      }
      professionalId = adminProfile.id;
    }

    // 5. Deduplication check:
    // Clave: payment_date (solo fecha), patient_id, amount_ars, payment_method
    const payDate = new Date(rec.payment_date).toISOString().slice(0, 10); // YYYY-MM-DD
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("patient_id", patientId!)
      .eq("amount_ars", rec.amount_ars)
      .eq("payment_method", rec.payment_method)
      .gte("payment_date", `${payDate}T00:00:00Z`)
      .lte("payment_date", `${payDate}T23:59:59Z`)
      .maybeSingle();

    if (existing) {
      result.skipped_duplicates++;
      continue;
    }

    // 6. Insert
    const { error } = await supabaseAdmin.from("payments").insert({
      patient_id: patientId,
      professional_profile_id: professionalId,
      appointment_id: rec.appointment_id ?? null,
      order_id: rec.order_id ?? null,
      amount_ars: rec.amount_ars,
      amount_usd: rec.amount_usd ?? null,
      currency: rec.currency ?? "ARS",
      payment_method: rec.payment_method,
      commission_amount_ars: rec.commission_amount_ars ?? 0,
      payment_date: new Date(rec.payment_date).toISOString(),
    });

    if (error) {
      result.rejected.push({ index: i, reason: error.message, record: rec });
    } else {
      result.inserted++;
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      total_received: records.length,
      inserted: result.inserted,
      skipped_duplicates: result.skipped_duplicates,
      rejected: result.rejected.length,
    },
    rejected_detail: result.rejected,
  });
}
