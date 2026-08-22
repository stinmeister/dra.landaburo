'use server';
// Server Action — toggles is_completed on an employee_task.
// Runs server-side so it has access to the Supabase server client and the
// authenticated session cookies. Revalidation is handled by the calling
// Client Component via router.refresh().
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Roles que pueden interactuar con las tareas operativas.
// 'paciente' queda excluido intencionalmente — un paciente registrado públicamente
// no debe poder modificar el estado de las tareas del staff.
const STAFF_ROLES = ['admin', 'medico', 'operativo', 'cosmetologa'];

export async function toggleTask(taskId: string, currentValue: boolean) {
  const supabase = await createClient();

  // Verificar que el usuario autenticado tiene un rol de staff autorizado.
  // Un paciente (o usuario sin sesión) que llame a este action directamente
  // debe ser rechazado antes de tocar la base de datos.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !STAFF_ROLES.includes(profile.role)) redirect('/dashboard/operativo');

  const { error } = await supabase
    .from('employee_tasks')
    .update({
      is_completed: !currentValue,
      // Set completed_at timestamp when marking done, clear when unmarking
      completed_at: !currentValue ? new Date().toISOString() : null,
    })
    .eq('id', taskId);

  if (error) {
    throw new Error(`No se pudo actualizar la tarea: ${error.message}`);
  }

  // Revalidate so the page re-fetches fresh task data
  revalidatePath('/dashboard/operativo');
}
