import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Resuelve el usuario autenticado desde header Bearer (JWT) o cookie de sesión de Next.js
 */
async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const adminClient = createAdminClient();
    const {
      data: { user },
      error,
    } = await adminClient.auth.getUser(token);
    if (!error && user) {
      return user;
    }
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user || null;
  } catch {
    return null;
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
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Acceso denegado: se requiere rol de administrador" },
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
 * Consulta el estado de una corrida específica (?run_id=...) o de la última corrida registrada.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Acceso denegado: se requiere rol de administrador" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("run_id");

  let query = adminClient
    .from("ingest_runs")
    .select(
      "id, started_at, finished_at, triggered_by, triggered_by_name, trigger_source, n8n_execution_id, status, summary"
    );

  if (runId) {
    query = query.eq("id", runId);
  } else {
    query = query.order("started_at", { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[run-ingesta GET] Error consultando ingest_runs:", error);
    return NextResponse.json({ error: "Error al consultar corrida" }, { status: 500 });
  }

  return NextResponse.json({ run: data || null });
}
