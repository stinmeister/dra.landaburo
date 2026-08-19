'use server';
// Server Action — toggles is_completed on an employee_task.
// Runs server-side so it has access to the Supabase server client and the
// authenticated session cookies. Revalidation is handled by the calling
// Client Component via router.refresh().
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function toggleTask(taskId: string, currentValue: boolean) {
  const supabase = await createClient();

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
