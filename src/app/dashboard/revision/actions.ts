'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function updateReviewStatusAction(
  id: string,
  newStatus: 'resolved' | 'dismissed',
  notes?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const admin = createAdminClient();
  const { error } = await admin
    .from('ingest_review')
    .update({
      status: newStatus,
      resolution_notes: notes ?? null,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Error al actualizar estado: ${error.message}`);
  }

  revalidatePath('/dashboard/revision');
  revalidatePath('/dashboard/ejecutivo');
  return { success: true };
}

export async function bulkUpdateReviewStatusAction(
  ids: string[],
  newStatus: 'resolved' | 'dismissed',
  notes?: string
) {
  if (!ids || ids.length === 0) return { success: true, count: 0 };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const admin = createAdminClient();
  const { error } = await admin
    .from('ingest_review')
    .update({
      status: newStatus,
      resolution_notes: notes ?? null,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) {
    throw new Error(`Error en actualización masiva: ${error.message}`);
  }

  revalidatePath('/dashboard/revision');
  revalidatePath('/dashboard/ejecutivo');
  return { success: true, count: ids.length };
}
