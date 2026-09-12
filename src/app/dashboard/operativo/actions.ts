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
  birthdayAssignee?: string;
  giftcardAssignee?: string;
  stockAssignee?: string;
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

    // 1. Consultar reglas existentes en recurring_task_rules
    const { data: existingRules, error: rulesErr } = await admin
      .from('recurring_task_rules')
      .select('id, recurrence_type, title');

    if (rulesErr) {
      return { success: false, error: `Error al consultar recurring_task_rules: ${rulesErr.message}` };
    }

    const updated: string[] = [];
    const skipped: string[] = [];

    // 2. Actualizar regla de Stock (weekly_friday)
    const stockRule = (existingRules ?? []).find(
      (r) => r.recurrence_type === 'weekly_friday' || r.title?.toLowerCase().includes('stock')
    );
    if (assignments.stockAssignee) {
      if (stockRule) {
        const { error: updErr } = await admin
          .from('recurring_task_rules')
          .update({
            assigned_profile_id: assignments.stockAssignee,
          })
          .eq('id', stockRule.id);

        if (updErr) {
          return { success: false, error: `No se pudo actualizar regla de stock: ${updErr.message}` };
        }
        updated.push('Control de Stock');
      } else {
        skipped.push('Control de Stock (regla no existe en base de datos)');
      }
    }

    // 3. Actualizar regla de Cumpleaños si existe
    if (assignments.birthdayAssignee) {
      const birthdayRule = (existingRules ?? []).find(
        (r) => r.recurrence_type === 'daily' || r.title?.toLowerCase().includes('cumpleaños')
      );
      if (birthdayRule) {
        const { error: updErr } = await admin
          .from('recurring_task_rules')
          .update({
            assigned_profile_id: assignments.birthdayAssignee,
          })
          .eq('id', birthdayRule.id);

        if (updErr) {
          return { success: false, error: `No se pudo actualizar regla de cumpleaños: ${updErr.message}` };
        }
        updated.push('Saludos de Cumpleaños');
      } else {
        skipped.push('Saludos de Cumpleaños (regla no existe en base de datos)');
      }
    }

    // 4. Actualizar regla de Gift Cards si existe
    if (assignments.giftcardAssignee) {
      const giftcardRule = (existingRules ?? []).find(
        (r) =>
          r.recurrence_type === 'on_demand' ||
          r.recurrence_type === 'event_triggered' ||
          r.title?.toLowerCase().includes('gift')
      );
      if (giftcardRule) {
        const { error: updErr } = await admin
          .from('recurring_task_rules')
          .update({
            assigned_profile_id: assignments.giftcardAssignee,
          })
          .eq('id', giftcardRule.id);

        if (updErr) {
          return { success: false, error: `No se pudo actualizar regla de gift cards: ${updErr.message}` };
        }
        updated.push('Preparación de Gift Cards');
      } else {
        skipped.push('Preparación de Gift Cards (regla no existe en base de datos)');
      }
    }

    if (updated.length === 0 && skipped.length > 0) {
      return {
        success: false,
        error: `No se actualizó ninguna asignación: ${skipped.join(', ')}.`,
      };
    }

    revalidatePath('/dashboard/operativo');
    revalidatePath('/dashboard/ejecutivo');

    let msg = `✓ Responsable(s) guardado(s) en recurring_task_rules: ${updated.join(', ')}.`;
    if (skipped.length > 0) {
      msg += ` [Aviso R11: ${skipped.join(', ')}]`;
    }

    return {
      success: true,
      message: msg,
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

