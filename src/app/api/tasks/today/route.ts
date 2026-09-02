// GET /api/tasks/today
// Returns today's pending staff_tasks for the authenticated user.
// Admins get all tasks for today. Staff gets only their own.
// PATCH /api/tasks/today — toggle a task status.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const STAFF_ROLES = ['admin', 'medico', 'operativo', 'cosmetologa'];

async function getAuthProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single<{ id: string; role: string; full_name: string | null }>();

  return { supabase, user, profile };
}

export async function GET() {
  const { supabase, user, profile } = await getAuthProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (!STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 });
  }

  const todayAR = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());

  let query = supabase
    .from('staff_tasks')
    .select('id, title, description, task_type, status, related_entity_type, related_entity_id')
    .eq('due_date', todayAR)
    .order('task_type', { ascending: true })
    .order('created_at', { ascending: true });

  if (profile.role !== 'admin') {
    query = query.eq('assigned_profile_id', profile.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Tasks/Today] DB error:', error);
    return NextResponse.json({ error: 'Error al cargar tareas.' }, { status: 500 });
  }

  return NextResponse.json({ tasks: data ?? [], today: todayAR });
}

export async function PATCH(req: NextRequest) {
  const { supabase, user, profile } = await getAuthProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (!STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 });
  }

  let body: { task_id: string; status: 'pendiente' | 'completada' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const { task_id, status } = body;
  if (!task_id || !['pendiente', 'completada'].includes(status)) {
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
  }

  // Verify ownership (unless admin)
  if (profile.role !== 'admin') {
    const { data: task } = await supabase
      .from('staff_tasks')
      .select('assigned_profile_id')
      .eq('id', task_id)
      .single();
    if (!task || task.assigned_profile_id !== profile.id) {
      return NextResponse.json({ error: 'Sin permisos para esta tarea.' }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from('staff_tasks')
    .update({
      status,
      completed_at: status === 'completada' ? new Date().toISOString() : null,
    })
    .eq('id', task_id);

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, task_id, status });
}
