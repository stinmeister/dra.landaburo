import { createAdminClient } from '@/lib/supabase/admin';
import type { PermissionsDbClient } from '@/lib/permissions';
import {
  requireSectionAccess,
  type RequireSectionAccessDeps,
} from '@/lib/permissions-server';

export const MAX_BULK_REVIEW_IDS = 500;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export type ReviewResolutionStatus = 'resolved' | 'dismissed';

function assertValidResolutionStatus(
  status: unknown
): asserts status is ReviewResolutionStatus {
  if (status !== 'resolved' && status !== 'dismissed') {
    throw new Error("Estado inválido: debe ser 'resolved' o 'dismissed'");
  }
}

export interface IngestReviewWriteClient {
  from: (table: 'ingest_review') => {
    update: (payload: {
      status: ReviewResolutionStatus;
      resolution_notes: string | null;
      resolved_by: string;
      resolved_at: string;
    }) => {
      eq: (
        column: 'id',
        value: string
      ) => {
        select: (
          columns: 'id'
        ) => PromiseLike<{
          data: Array<{ id: string }> | null;
          error: { message: string } | null;
        }>;
      };
      in: (
        column: 'id',
        values: string[]
      ) => {
        select: (
          columns: 'id'
        ) => PromiseLike<{
          data: Array<{ id: string }> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export interface ReviewActionDeps extends RequireSectionAccessDeps {
  writeClient?: IngestReviewWriteClient;
}

export async function executeUpdateReviewStatus(
  id: string,
  newStatus: ReviewResolutionStatus,
  notes?: string,
  deps?: ReviewActionDeps
): Promise<{ success: true; count: number }> {
  // 1. Verificar permiso en el servidor con la misma regla de la UI (permissions.ts)
  const { userId } = await requireSectionAccess('revision', deps);

  // 2. Validar parámetros antes de tocar la base
  assertValidResolutionStatus(newStatus);
  if (!isValidUuid(id)) {
    throw new Error('ID inválido: debe ser un UUID válido');
  }

  // 3. Persistir cambio con service_role
  const admin =
    deps?.writeClient ??
    ((deps?.adminClient ?? createAdminClient()) as unknown as IngestReviewWriteClient);

  const { data, error } = await admin
    .from('ingest_review')
    .update({
      status: newStatus,
      resolution_notes: notes ?? null,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id');

  if (error) {
    throw new Error(`Error al actualizar estado: ${error.message}`);
  }

  return { success: true, count: data?.length ?? 0 };
}

export async function executeBulkUpdateReviewStatus(
  ids: string[],
  newStatus: ReviewResolutionStatus,
  notes?: string,
  deps?: ReviewActionDeps
): Promise<{ success: true; count: number }> {
  // 1. Verificar permiso en el servidor con la misma regla de la UI (permissions.ts)
  const { userId } = await requireSectionAccess('revision', deps);

  // 2. Validar estado, arreglo no vacío, tope máximo y formato UUID
  assertValidResolutionStatus(newStatus);

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('Se requiere un arreglo no vacío de IDs para actualizar');
  }

  if (ids.length > MAX_BULK_REVIEW_IDS) {
    throw new Error(
      `Se supera el tope máximo de ${MAX_BULK_REVIEW_IDS} IDs por llamada (recibidos: ${ids.length})`
    );
  }

  const invalidItem = ids.find((item) => !isValidUuid(item));
  if (invalidItem !== undefined) {
    throw new Error('Todos los elementos de ids deben ser UUID válidos');
  }

  const uniqueIds = Array.from(new Set(ids));

  // 3. Persistir cambio masivo con service_role
  const admin =
    deps?.writeClient ??
    ((deps?.adminClient ?? createAdminClient()) as unknown as IngestReviewWriteClient);

  const { data, error } = await admin
    .from('ingest_review')
    .update({
      status: newStatus,
      resolution_notes: notes ?? null,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    })
    .in('id', uniqueIds)
    .select('id');

  if (error) {
    throw new Error(`Error en actualización masiva: ${error.message}`);
  }

  return { success: true, count: data?.length ?? 0 };
}

export type { PermissionsDbClient };
