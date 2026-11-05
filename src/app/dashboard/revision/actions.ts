'use server';

import { revalidatePath } from 'next/cache';
import {
  executeUpdateReviewStatus,
  executeBulkUpdateReviewStatus,
} from './reviewActionsCore';

export async function updateReviewStatusAction(
  id: string,
  newStatus: 'resolved' | 'dismissed',
  notes?: string
) {
  const result = await executeUpdateReviewStatus(id, newStatus, notes);
  revalidatePath('/dashboard/revision');
  revalidatePath('/dashboard/ejecutivo');
  return result;
}

export async function bulkUpdateReviewStatusAction(
  ids: string[],
  newStatus: 'resolved' | 'dismissed',
  notes?: string
) {
  const result = await executeBulkUpdateReviewStatus(ids, newStatus, notes);
  revalidatePath('/dashboard/revision');
  revalidatePath('/dashboard/ejecutivo');
  return result;
}
