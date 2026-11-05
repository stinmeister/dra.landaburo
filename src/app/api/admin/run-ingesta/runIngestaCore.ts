/**
 * Lógica central de POST /api/admin/run-ingesta (FIX-139)
 * Separada de route.ts para permitir tests unitarios aislados sin violar las
 * restricciones de exports de Next.js App Router en archivos route.ts.
 */

export const DISPATCH_FAILED_STATUS = "abandonada" as const;
export const NOT_CONFIGURED_MESSAGE =
  "La ingesta automática todavía no está conectada";

export interface RunIngestaSummaryItem {
  source: string;
  status: string;
  ok: boolean;
  error_details?: string;
}

export interface RunIngestaAdminDb {
  from: (table: string) => any;
}

export interface RunIngestaUserClient {
  rpc: (
    fn: string
  ) => PromiseLike<{ data: boolean | null; error: { message?: string; code?: string } | null }>;
}

export interface RunIngestaPostDeps {
  getAuthContext: () => Promise<{
    user: { id: string; email?: string | null } | null;
    userClient: RunIngestaUserClient | null;
  }>;
  createAdminClient: () => RunIngestaAdminDb;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  nowFn?: () => number;
}

export interface RunIngestaHttpResult {
  status: number;
  body: Record<string, unknown>;
}

export function isWf00WebhookConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const url = (env.N8N_WF00_WEBHOOK_URL || env.WF00_WEBHOOK_URL || "").trim();
  return url.length > 0;
}

export async function executeRunIngestaPost(
  deps: RunIngestaPostDeps
): Promise<RunIngestaHttpResult> {
  const env = deps.env ?? process.env;
  const fetchFn = deps.fetchFn ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 10000;
  const nowMs = deps.nowFn ? deps.nowFn() : Date.now();

  // 1. Validar autenticación y rol admin server-side
  const { user, userClient } = await deps.getAuthContext();
  if (!user || !userClient) {
    return {
      status: 401,
      body: { error: "No autorizado" },
    };
  }

  const { data: isAdminRpc, error: isAdminErr } = await userClient.rpc("is_admin");
  if (isAdminErr || !isAdminRpc) {
    return {
      status: 403,
      body: {
        error: "No sos admin: se requiere rol de administrador",
        code: "42501",
      },
    };
  }

  const adminClient = deps.createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return {
      status: 403,
      body: {
        error: "No sos admin: se requiere rol de administrador",
        code: "42501",
      },
    };
  }

  // 2. Caso 1 (FIX-139): Sin URL configurada -> NO insertar ninguna fila y responder explícito
  const webhookUrl = (env.N8N_WF00_WEBHOOK_URL || env.WF00_WEBHOOK_URL || "").trim();
  const runSecret = (env.N8N_RUN_SECRET || env.WF00_RUN_SECRET || "").trim();

  if (!webhookUrl) {
    return {
      status: 503,
      body: {
        state: "not_configured",
        error: NOT_CONFIGURED_MESSAGE,
      },
    };
  }

  // 3. Comprobar candado de ejecución (lock de 15 minutos)
  const fifteenMinutesMs = 15 * 60 * 1000;

  const { data: runningRuns, error: fetchError } = await adminClient
    .from("ingest_runs")
    .select("id, started_at, status")
    .eq("status", "running")
    .order("started_at", { ascending: false });

  if (fetchError) {
    console.error("[run-ingesta] Error consultando ingest_runs:", fetchError);
    return {
      status: 500,
      body: { error: "Error de base de datos" },
    };
  }

  if (runningRuns && runningRuns.length > 0) {
    const activeRun = runningRuns.find((r: { started_at?: string | null }) => {
      if (!r.started_at) return false;
      const startedMs = new Date(r.started_at).getTime();
      return nowMs - startedMs < fifteenMinutesMs;
    });

    if (activeRun) {
      return {
        status: 409,
        body: {
          error: "Ya existe una ingesta en ejecución.",
          run_id: activeRun.id,
          started_at: activeRun.started_at,
        },
      };
    }

    const staleIds = runningRuns
      .filter((r: { started_at?: string | null }) => {
        if (!r.started_at) return true;
        const startedMs = new Date(r.started_at).getTime();
        return nowMs - startedMs >= fifteenMinutesMs;
      })
      .map((r: { id: string }) => r.id);

    if (staleIds.length > 0) {
      await adminClient
        .from("ingest_runs")
        .update({
          status: "abandonada",
          finished_at: new Date(nowMs).toISOString(),
        })
        .in("id", staleIds);
    }
  }

  // 4. Crear la fila en ingest_runs (solo cuando sí hay URL configurada)
  const startedAt = new Date(nowMs).toISOString();
  const { data: newRun, error: insertError } = await adminClient
    .from("ingest_runs")
    .insert({
      status: "running",
      trigger_source: "boton_web",
      triggered_by: user.id,
      triggered_by_name: profile.full_name || user.email || "Admin",
      started_at: startedAt,
    })
    .select("id, started_at, status")
    .single();

  if (insertError || !newRun) {
    console.error("[run-ingesta] Error insertando ingest_run:", insertError);
    return {
      status: 500,
      body: { error: "Error al registrar la corrida" },
    };
  }

  // 5. Invocar webhook de WF-00 y manejar fallos explícitamente (Caso 2, FIX-139)
  let failureReason: string | null = null;
  let failureHttpStatus = 502;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const n8nRes = await fetchFn(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(runSecret ? { "X-Run-Secret": runSecret } : {}),
      },
      body: JSON.stringify({ run_id: newRun.id }),
      signal: controller.signal,
    });

    if (!n8nRes.ok) {
      let bodySnippet = "";
      try {
        const rawText = await n8nRes.text();
        if (rawText) {
          bodySnippet = rawText.slice(0, 180).trim();
        }
      } catch {
        // Ignorar si no se puede leer el cuerpo de error
      }
      failureReason = bodySnippet
        ? `n8n respondió HTTP ${n8nRes.status}: ${bodySnippet}`
        : `n8n respondió HTTP ${n8nRes.status}`;
      failureHttpStatus = 502;
    }
  } catch (webhookErr: unknown) {
    const isAbort =
      webhookErr instanceof Error &&
      (webhookErr.name === "AbortError" ||
        /aborted|timeout/i.test(webhookErr.message));
    if (isAbort) {
      failureReason = `Tiempo de espera agotado al contactar a n8n (${Math.round(
        timeoutMs / 1000
      )}s)`;
      failureHttpStatus = 504;
    } else {
      const msg =
        webhookErr instanceof Error
          ? webhookErr.message
          : String(webhookErr);
      failureReason = `Error de red al invocar n8n: ${msg}`;
      failureHttpStatus = 502;
    }
  } finally {
    clearTimeout(timer);
  }

  if (failureReason) {
    const finishedAt = new Date().toISOString();
    const failureSummary: RunIngestaSummaryItem[] = [
      {
        source: "wf00_disparo",
        status: "error",
        ok: false,
        error_details: failureReason,
      },
    ];

    const { error: updateErr } = await adminClient
      .from("ingest_runs")
      .update({
        status: DISPATCH_FAILED_STATUS,
        finished_at: finishedAt,
        summary: failureSummary,
      })
      .eq("id", newRun.id);

    if (updateErr) {
      console.error(
        "[run-ingesta] Error al cerrar fila fallida en ingest_runs:",
        updateErr
      );
    }

    return {
      status: failureHttpStatus,
      body: {
        state: "dispatch_failed",
        error: failureReason,
        run_id: newRun.id,
        started_at: newRun.started_at,
        finished_at: finishedAt,
        status: DISPATCH_FAILED_STATUS,
        summary: failureSummary,
      },
    };
  }

  // 6. Disparo aceptado por n8n (2xx)
  return {
    status: 200,
    body: {
      run_id: newRun.id,
      status: newRun.status,
      started_at: newRun.started_at,
    },
  };
}
