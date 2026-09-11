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
