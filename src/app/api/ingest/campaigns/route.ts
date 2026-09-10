import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// POST /api/ingest/campaigns
// Auth: Authorization: Bearer $INGEST_SECRET
//
// Acepta un array de campanas desde Notion (via n8n).
// Idempotente: usa notion_id como clave de deduplicacion (upsert).
// Si notion_id no se provee, cae a: title + platform + start_date.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Schema de ad_campaigns (destino):
// id                 uuid PK (auto)
// title              text NOT NULL
// platform           text  (Meta Ads | Google Ads | TikTok Ads | Email Marketing | Otro)
// status             text  (activa | pausada | finalizada | planificada) [DDL pendiente para planificada]
// ad_copy            text nullable
// target_treatment   text nullable
// promo_details      text nullable  [candidato a renombrar: aviso_destacado]
// suggested_response text nullable
// start_date         date nullable
// end_date           date nullable
// utm_campaign       text nullable
// notes              text nullable
// notion_id          text nullable UNIQUE  [DDL pendiente: agregar esta columna para dedup]
// created_at         timestamptz auto
// updated_at         timestamptz

interface CampaignRecord {
  notion_id?: string;      // ID de la pagina/item en Notion [clave de dedup principal]
  title: string;
  platform?: string;
  status?: "activa" | "pausada" | "finalizada" | "planificada";
  ad_copy?: string | null;
  target_treatment?: string | null;
  promo_details?: string | null;   // o aviso_destacado si se renombra
  suggested_response?: string | null;
  start_date?: string | null;      // YYYY-MM-DD
  end_date?: string | null;        // YYYY-MM-DD
  utm_campaign?: string | null;
  notes?: string | null;
}

interface IngestResult {
  upserted: number;
  rejected: { index: number; reason: string; record: CampaignRecord }[];
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get("authorization");
  const secret = process.env.INGEST_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let records: CampaignRecord[];
  try {
    const body = await req.json();
    records = Array.isArray(body) ? body : body.records;
    if (!Array.isArray(records)) throw new Error("Payload debe ser array o {records:[]}");
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: `JSON invalido: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 }
    );
  }

  const result: IngestResult = { upserted: 0, rejected: [] };

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    if (!rec.title?.trim()) {
      result.rejected.push({ index: i, reason: "title es requerido", record: rec });
      continue;
    }

    const validStatuses = ["activa", "pausada", "finalizada", "planificada"];
    const status = rec.status ?? "planificada";
    if (!validStatuses.includes(status)) {
      result.rejected.push({ index: i, reason: `status invalido: "${status}". Validos: ${validStatuses.join(", ")}`, record: rec });
      continue;
    }

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      title: rec.title.trim(),
      platform: rec.platform ?? "Meta Ads",
      status,
      ad_copy: rec.ad_copy ?? null,
      target_treatment: rec.target_treatment ?? null,
      promo_details: rec.promo_details ?? null,
      suggested_response: rec.suggested_response ?? null,
      start_date: rec.start_date ?? null,
      end_date: rec.end_date ?? null,
      utm_campaign: rec.utm_campaign ?? null,
      notes: rec.notes ?? null,
      updated_at: now,
    };

    // Si notion_id esta disponible: upsert por notion_id
    // Si no: upsert por title+platform+start_date
    let error;
    if (rec.notion_id) {
      payload.notion_id = rec.notion_id;
      const res = await supabaseAdmin
        .from("ad_campaigns")
        .upsert(payload, { onConflict: "notion_id" });
      error = res.error;
    } else {
      // Sin notion_id: buscar por title+platform para decidir insert o update
      const { data: existing } = await supabaseAdmin
        .from("ad_campaigns")
        .select("id")
        .eq("title", rec.title.trim())
        .eq("platform", rec.platform ?? "Meta Ads")
        .maybeSingle();

      if (existing) {
        const res = await supabaseAdmin
          .from("ad_campaigns")
          .update(payload)
          .eq("id", existing.id);
        error = res.error;
      } else {
        payload.created_at = now;
        const res = await supabaseAdmin.from("ad_campaigns").insert(payload);
        error = res.error;
      }
    }

    if (error) {
      result.rejected.push({ index: i, reason: error.message, record: rec });
    } else {
      result.upserted++;
    }
  }

  revalidatePath("/dashboard/campanas");
  revalidatePath("/dashboard/operativo");

  return NextResponse.json({
    success: true,
    summary: {
      total_received: records.length,
      upserted: result.upserted,
      rejected: result.rejected.length,
    },
    rejected_detail: result.rejected,
  });
}
