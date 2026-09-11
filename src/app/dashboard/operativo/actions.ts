'use server';
// Server Actions — toggle staff_tasks status.
// Reemplaza el acceso a 'employee_tasks' (tabla que causaba el error).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

export async function updateOperationalAssignments(assignments: {
  birthdayAssignee: string;
  giftcardAssignee: string;
  stockAssignee: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Sesión no iniciada. Por favor iniciá sesión nuevamente.' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Solo administradores pueden modificar asignaciones operativas.' };
    }

    const admin = createAdminClient();

    // 1. Persistir el responsable de control de stock en recurring_task_rules
    if (assignments.stockAssignee) {
      const { error: ruleErr } = await admin
        .from('recurring_task_rules')
        .update({ assigned_profile_id: assignments.stockAssignee })
        .eq('recurrence_type', 'weekly_friday');

      if (ruleErr) {
        return { success: false, error: `No se pudo actualizar la regla de stock: ${ruleErr.message}` };
      }
    }

    // 2. Persistir asignaciones globales en app_settings
    let warningMsg = '';
    const { error: setErr } = await admin.from('app_settings').upsert(
      {
        id: 'default',
        default_birthday_assignee: assignments.birthdayAssignee || null,
        default_giftcard_assignee: assignments.giftcardAssignee || null,
        default_stock_assignee: assignments.stockAssignee || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (setErr) {
      // Si la tabla no existe en la base de datos (PostgREST schema cache o Postgres 42P01)
      const isMissingTable = setErr.code === '42P01' || 
        setErr.code === 'PGRST205' || 
        setErr.message?.toLowerCase().includes('schema cache') || 
        setErr.message?.toLowerCase().includes('does not exist');

      if (isMissingTable) {
        console.warn('[OperationalAssignments] Tabla app_settings pendiente de DDL en Supabase.');
        warningMsg = ' (Nota: Asignación de stock guardada en reglas. Tabla app_settings pendiente de migración en base de datos)';
      } else {
        return { success: false, error: `Error al guardar configuración general: ${setErr.message}` };
      }
    }

    revalidatePath('/dashboard/operativo');
    revalidatePath('/dashboard/ejecutivo');

    return {
      success: true,
      message: `✓ Responsables actualizados correctamente.${warningMsg}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error inesperado al guardar asignaciones operativas.',
    };
  }
}

export async function toggleKioskAdmissionStatus(id: string, newStatus: 'nuevo' | 'atendido') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    throw new Error('Sin permisos para actualizar admisiones.');
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { error } = await admin
    .from('kiosk_admissions')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/operativo');
  return { success: true };
}

