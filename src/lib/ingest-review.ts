import { createAdminClient } from "@/lib/supabase/admin";

export interface IngestReviewInput {
  source: "patients" | "payments";
  record_identifier?: string | null;
  reason: string;
  payload: Record<string, unknown>;
}

export interface IngestReviewRecord {
  id: string;
  source: "patients" | "payments";
  record_identifier: string | null;
  reason: string;
  payload: Record<string, unknown>;
  status: "pending" | "resolved" | "dismissed";
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

/**
 * Persiste registros marcados para revision en la tabla public.ingest_review.
 * Idempotente: si ya existe un registro con la misma tupla (source, record_identifier, reason)
 * en estado 'pending', no se duplica.
 * Degradacion elegante: si la tabla aun no existe en Supabase (DDL_PENDING),
 * atrapa el error sin interrumpir el request.
 */
export async function persistReviewItems(items: IngestReviewInput[]): Promise<number> {
  if (!items || items.length === 0) return 0;

  try {
    const admin = createAdminClient();
    let saved = 0;

    for (const item of items) {
      const identifier = item.record_identifier?.trim() || "sin_id";

      // Verificar idempotencia: existe pendiente previo?
      const { data: existing, error: findErr } = await admin
        .from("ingest_review")
        .select("id")
        .eq("source", item.source)
        .eq("record_identifier", identifier)
        .eq("reason", item.reason)
        .eq("status", "pending")
        .maybeSingle();

      if (findErr) {
        // Si la tabla no existe en Postgres, abortamos silenciosamente
        if (
          findErr.message.includes("does not exist") ||
          findErr.code === "42P01" ||
          findErr.code === "PGRST205"
        ) {
          console.warn("[ingest_review] Tabla ingest_review no existe en DB (DDL_PENDING)");
          return 0;
        }
        console.warn("[ingest_review] Error al verificar existencia:", findErr.message);
        continue;
      }

      if (existing) {
        // Ya registrado y pendiente, no duplicar
        continue;
      }

      const { error: insertErr } = await admin.from("ingest_review").insert({
        source: item.source,
        record_identifier: identifier,
        reason: item.reason,
        payload: item.payload,
        status: "pending",
      });

      if (!insertErr) {
        saved++;
      } else {
        console.warn("[ingest_review] Error al insertar review item:", insertErr.message);
      }
    }

    return saved;
  } catch (err: unknown) {
    console.warn("[ingest_review] Error general al persistir review items:", err);
    return 0;
  }
}

/**
 * Retorna la cantidad de registros en estado 'pending'.
 * Devuelve 0 si la tabla no existe o ante cualquier error.
 */
export async function getPendingReviewCount(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("ingest_review")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Obtiene lista de registros de revision con filtros opcionales.
 */
export async function getReviewItems(filter?: {
  status?: string;
  source?: string;
  limit?: number;
}): Promise<IngestReviewRecord[]> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("ingest_review")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter?.status && filter.status !== "all") {
      query = query.eq("status", filter.status);
    }
    if (filter?.source && filter.source !== "all") {
      query = query.eq("source", filter.source);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data as IngestReviewRecord[]) ?? [];
  } catch {
    return [];
  }
}
