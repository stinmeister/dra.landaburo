import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
 * 2. Bloqueo de 15 min: si hay status='running' con started_at < 15 min -> 409 Conflict.
 * 3. Si hay status='running' con >= 15 min -> se actualiza a 'abandonada' y se continúa.
 * 4. Inserta fila en ingest_runs (status='running', trigger_source='boton_web', triggered_by).
 * 5. Llama a webhook de WF-00 con header X-Run-Secret y { run_id }.
 * 6. Devuelve { run_id, status: 'running', started_at }.
 */
export async function POST(req: NextRequest) {
  // 1. Validar autenticación y rol admin server-side
  const { client: userClient, user } = await getUserSupabaseClient(req);
  if (!user || !userClient) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Verificar guarda canónica public.is_admin() con el cliente del usuario
  const { data: isAdminRpc, error: isAdminErr } = await userClient.rpc("is_admin");
  if (isAdminErr || !isAdminRpc) {
    return NextResponse.json(
      { error: "No sos admin: se requiere rol de administrador", code: "42501" },
      { status: 403 }
    );
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "No sos admin: se requiere rol de administrador", code: "42501" },
      { status: 403 }
    );
  }

  // 2. Comprobar candado de ejecución (lock de 15 minutos)
  const nowMs = Date.now();
  const fifteenMinutesMs = 15 * 60 * 1000;

  const { data: runningRuns, error: fetchError } = await adminClient
    .from("ingest_runs")
    .select("id, started_at, status")
    .eq("status", "running")
    .order("started_at", { ascending: false });

  if (fetchError) {
    console.error("[run-ingesta] Error consultando ingest_runs:", fetchError);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  if (runningRuns && runningRuns.length > 0) {
    // 2.1 Buscar si hay alguna corrida activa de menos de 15 minutos
    const activeRun = runningRuns.find((r) => {
      if (!r.started_at) return false;
      const startedMs = new Date(r.started_at).getTime();
      return nowMs - startedMs < fifteenMinutesMs;
    });

    if (activeRun) {
      return NextResponse.json(
        {
          error: "Ya existe una ingesta en ejecución.",
          run_id: activeRun.id,
          started_at: activeRun.started_at,
        },
        { status: 409 }
      );
    }

    // 3. Si hay corridas 'running' con más de 15 minutos, marcarlas como 'abandonada'
    const staleIds = runningRuns
      .filter((r) => {
        if (!r.started_at) return true;
        const startedMs = new Date(r.started_at).getTime();
        return nowMs - startedMs >= fifteenMinutesMs;
      })
      .map((r) => r.id);

    if (staleIds.length > 0) {
      await adminClient
        .from("ingest_runs")
        .update({
          status: "abandonada",
          finished_at: new Date().toISOString(),
        })
        .in("id", staleIds);
    }
  }

  // 4. Crear la fila en ingest_runs con triggered_by y triggered_by_name de la sesión
  const startedAt = new Date().toISOString();
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
    return NextResponse.json({ error: "Error al registrar la corrida" }, { status: 500 });
  }

  // 5. Invocación de webhook de WF-00
  const webhookUrl = process.env.N8N_WF00_WEBHOOK_URL || process.env.WF00_WEBHOOK_URL;
  const runSecret = process.env.N8N_RUN_SECRET || process.env.WF00_RUN_SECRET;

  if (webhookUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const n8nRes = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(runSecret ? { "X-Run-Secret": runSecret } : {}),
        },
        body: JSON.stringify({ run_id: newRun.id }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!n8nRes.ok) {
        console.warn(`[run-ingesta] WF-00 respondió con código ${n8nRes.status}`);
      }
    } catch (webhookErr) {
      console.error("[run-ingesta] Error al invocar webhook WF-00:", webhookErr);
    }
  } else {
    console.log(
      "[run-ingesta] N8N_WF00_WEBHOOK_URL no configurado aún en este entorno. Corrida registrada:",
      newRun.id
    );
  }

  // 6. Respuesta con run_id para seguimiento
  return NextResponse.json({
    run_id: newRun.id,
    status: newRun.status,
    started_at: newRun.started_at,
  });
}

/**
 * GET /api/admin/run-ingesta
 * Consulta la última corrida vía RPC `public.obtener_ultimo_ingest_run()` con el cliente
 * autenticado del usuario (sin fallback a service_role).
 * Distingue explícitamente tres estados:
 * - NULL          -> { run: null, state: 'empty' } ("todavía no se corrió ninguna ingesta")
 * - fila + status -> { run: <fila>, state: 'has_run' } (el resumen de la corrida)
 * - error 42501   -> HTTP 403 { run: null, state: 'forbidden', code: '42501' } ("no sos admin")
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

    if (rpcError.code === "PGRST202") {
      return NextResponse.json(
        {
          run: null,
          state: "rpc_missing",
          code: "PGRST202",
          error:
            "La RPC public.obtener_ultimo_ingest_run() aún no figura en el esquema de Supabase. Ejecutar PASO 1 en SQL Editor.",
        },
        { status: 503 }
      );
    }

    console.error("[run-ingesta GET] Error en RPC obtener_ultimo_ingest_run:", rpcError);
    return NextResponse.json(
      {
        run: null,
        state: "error",
        code: rpcError.code,
        error: rpcError.message || "Error al consultar última corrida",
      },
      { status: 500 }
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
      return NextResponse.json({ error: "Error al consultar corrida" }, { status: 500 });
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
