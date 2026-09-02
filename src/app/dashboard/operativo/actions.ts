'use server';
// Server Actions — toggle staff_tasks status.
// Reemplaza el acceso a 'employee_tasks' (tabla que causaba el error).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const STAFF_ROLES = ['admin', 'medico', 'operativo', 'cosmetologa'];

export async function toggleTask(taskId: string, currentValue: boolean) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single();

  if (!profile || !STAFF_ROLES.includes(profile.role)) redirect('/dashboard/operativo');

  // Verify the task belongs to this user (or user is admin)
  const { data: task } = await supabase
    .from('staff_tasks')
    .select('assigned_profile_id')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Tarea no encontrada.');
  if (task.assigned_profile_id !== profile.id && profile.role !== 'admin') {
    throw new Error('Sin permisos para modificar esta tarea.');
  }

  const newStatus = currentValue ? 'pendiente' : 'completada';

  const { error } = await supabase
    .from('staff_tasks')
    .update({
      status: newStatus,
      completed_at: newStatus === 'completada' ? new Date().toISOString() : null,
    })
    .eq('id', taskId);

  if (error) throw new Error(`No se pudo actualizar la tarea: ${error.message}`);

  revalidatePath('/dashboard/operativo');
}
