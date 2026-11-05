import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeRunIngestaPost } from "./runIngestaCore";

export const dynamic = "force-dynamic";

/**
 * Construye un cliente Supabase autenticado con la identidad del usuario (JWT Bearer o cookies SSR),
 * sin privilegios de service_role, para invocar RPCs con guarda de rol en base (public.is_admin()).
 */
async function getUserSupabaseClient(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const client = createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);
    if (!error && user) {
      return { client, user };
    }
    return { client: null, user: null };
  }

  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { client: null, user: null };
    return { client, user };
  } catch {
    return { client: null, user: null };
  }
}

/**
 * POST /api/admin/run-ingesta
 * Dispara una nueva corrida de ingesta de Calu (WF-00).
 * 1. Valida rol admin server-side -> 403 si no es admin.
 * 2. Sin URL configurada -> 503 { state: 'not_configured' } sin insertar fila en ingest_runs.
 * 3. Bloqueo de 15 min: si hay status='running' con started_at < 15 min -> 409 Conflict.
 * 4. Si hay status='running' con >= 15 min -> se actualiza a 'abandonada' y se continúa.
 * 5. Inserta fila en ingest_runs (status='running', trigger_source='boton_web', triggered_by).
 * 6. Llama a webhook de WF-00 con header X-Run-Secret y { run_id }.
 *    Si n8n falla (timeout, red o != 2xx), pasa la fila a 'abandonada' con finished_at y motivo en summary, y responde 502/504.
 * 7. Devuelve { run_id, status: 'running', started_at }.
 */
export async function POST(req: NextRequest) {
  const result = await executeRunIngestaPost({
    getAuthContext: async () => {
      const { client, user } = await getUserSupabaseClient(req);
      return {
        user: user ? { id: user.id, email: user.email } : null,
        userClient: client,
      };
    },
    createAdminClient: () => createAdminClient(),
  });

  return NextResponse.json(result.body, { status: result.status });
}

/**
 * GET /api/admin/run-ingesta
 * Consulta la última corrida vía RPC `public.obtener_ultimo_ingest_run()` con el cliente
 * autenticado del usuario (sin fallback a service_role).
 * Distingue explícitamente cuatro estados:
 * - NULL               -> { run: null, state: 'empty' } ("todavía no se corrió ninguna ingesta")
 * - fila + status      -> { run: <fila>, state: 'has_run' } (el resumen de la corrida)
 * - error 42501        -> HTTP 403 { run: null, state: 'forbidden', code: '42501' } ("no sos admin")
 * - otro error de base -> HTTP 503 { run: null, state: 'unavailable', code: '<raw_code>' } (con código crudo visible)
 */
export async function GET(req: NextRequest) {
  const { client: userClient, user } = await getUserSupabaseClient(req);
  if (!user || !userClient) {
    return NextResponse.json(
      { run: null, state: "forbidden", code: "42501", error: "No autorizado" },
      { status: 401 }
    );
  }

  const { data: rpcData, error: rpcError } = await userClient.rpc("obtener_ultimo_ingest_run");

  if (rpcError) {
    // Estado 3: error 42501 -> no sos admin
    if (rpcError.code === "42501") {
      return NextResponse.json(
        {
          run: null,
          state: "forbidden",
          code: "42501",
          error: "No sos admin (acceso denegado por public.obtener_ultimo_ingest_run)",
        },
        { status: 403 }
      );
    }

    // Estado 4: cualquier otro error de base -> 'unavailable' con el código crudo visible (ej. PGRST202)
    console.error("[run-ingesta GET] Estado unavailable en RPC obtener_ultimo_ingest_run:", rpcError);
    return NextResponse.json(
      {
        run: null,
        state: "unavailable",
        code: rpcError.code || "DB_ERROR",
        error: rpcError.message || "No se pudo consultar el estado de ingesta en la base de datos",
        details: rpcError.details || null,
        hint: rpcError.hint || null,
      },
      { status: 503 }
    );
  }

  // Si se consultó por un run_id específico durante el polling y difiere de la última fila
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("run_id");
  const latestRun = (rpcData as Record<string, unknown> | null) || null;

  if (runId && latestRun && latestRun.id !== runId) {
    // La guarda de rol ya fue validada por obtener_ultimo_ingest_run() en la base
    const adminClient = createAdminClient();
    const { data: specificRun, error: specificErr } = await adminClient
      .from("ingest_runs")
      .select(
        "id, started_at, finished_at, triggered_by, triggered_by_name, trigger_source, n8n_execution_id, status, summary"
      )
      .eq("id", runId)
      .maybeSingle();

    if (specificErr) {
      return NextResponse.json(
        {
          run: null,
          state: "unavailable",
          code: specificErr.code || "DB_ERROR",
          error: specificErr.message || "Error al consultar corrida específica",
          details: specificErr.details || null,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      run: specificRun || null,
      state: specificRun ? "has_run" : "empty",
    });
  }

  // Estado 1: NULL -> "todavía no se corrió ninguna ingesta"
  if (!latestRun) {
    return NextResponse.json({
      run: null,
      state: "empty",
    });
  }

  // Estado 2: fila + status -> el resumen de la corrida
  return NextResponse.json({
    run: latestRun,
    state: "has_run",
  });
}
