'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

async function assertTreatmentAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = profile?.role ?? '';
  if (!role || role === 'paciente') redirect('/portal/paciente');
  const { getUserSections } = await import('@/lib/permissions');
  const perms = await getUserSections(user.id, role);
  if (!perms.allowed.has('tratamientos')) redirect('/dashboard/operativo');
  return user;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function createTreatment(formData: FormData) {
  await assertTreatmentAccess();

  const title             = (formData.get('title') as string)?.trim();
  const category          = (formData.get('category') as string)?.trim();
  const rawArs            = (formData.get('price_ars') as string)?.trim();
  const rawUsd            = (formData.get('price_usd') as string)?.trim();
  const price_ars         = rawArs && !isNaN(parseFloat(rawArs)) ? parseFloat(rawArs) : null;
  const price_usd         = rawUsd && !isNaN(parseFloat(rawUsd)) ? parseFloat(rawUsd) : null;
  const duration_minutes  = parseInt(formData.get('duration_minutes') as string, 10) || 45;
  const description       = (formData.get('description') as string)?.trim() ?? '';
  const professional_role = (formData.get('professional_role') as string)?.trim() || 'medico';

  if (!title || !category) return;

  const slug = slugify(title);
  const admin = createAdminClient();

  await admin.from('treatments').insert({
    title,
    slug,
    category,
    price_ars,
    price_usd,
    duration_minutes,
    description,
    professional_role,
    is_active: true,
  });

  revalidatePath('/dashboard/tratamientos');
  revalidatePath('/tratamientos');
  revalidatePath('/tienda/gift-cards');
}

export async function updateTreatment(formData: FormData) {
  await assertTreatmentAccess();

  const id                = (formData.get('id') as string)?.trim();
  const title             = (formData.get('title') as string)?.trim();
  const category          = (formData.get('category') as string)?.trim();
  const rawArs            = (formData.get('price_ars') as string)?.trim();
  const rawUsd            = (formData.get('price_usd') as string)?.trim();
  const price_ars         = rawArs && !isNaN(parseFloat(rawArs)) ? parseFloat(rawArs) : null;
  const price_usd         = rawUsd && !isNaN(parseFloat(rawUsd)) ? parseFloat(rawUsd) : null;
  const duration_minutes  = parseInt(formData.get('duration_minutes') as string, 10) || 45;
  const description       = (formData.get('description') as string)?.trim() ?? '';
  const professional_role = (formData.get('professional_role') as string)?.trim() || 'medico';

  if (!id || !title || !category) return;

  const admin = createAdminClient();
  await admin.from('treatments').update({
    title,
    category,
    price_ars,
    price_usd,
    duration_minutes,
    description,
    professional_role,
  }).eq('id', id);

  revalidatePath('/dashboard/tratamientos');
  revalidatePath('/tratamientos');
  revalidatePath('/tienda/gift-cards');
}

export async function toggleTreatment(formData: FormData) {
  await assertTreatmentAccess();

  const id       = formData.get('id') as string;
  const isActive = formData.get('is_active') === 'true';

  if (!id) return;

  const admin = createAdminClient();
  await admin.from('treatments').update({ is_active: !isActive }).eq('id', id);

  revalidatePath('/dashboard/tratamientos');
  revalidatePath('/tratamientos');
  revalidatePath('/tienda/gift-cards');
}

async function assertAdminOnlyTreatment() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('id, role, full_name').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') {
    throw new Error('Acción no autorizada: Solo administradores pueden eliminar tratamientos.');
  }
  return { user, profile };
}

/**
 * Eliminación de un tratamiento.
 * PostgreSQL decide si se puede borrar (ON DELETE RESTRICT en appointments / gift_cards).
 * Si hay registros históricos, se rechaza y se ofrece pausar/archivar en su lugar.
 */
export async function deleteTreatment(
  id: string,
  confirmationTitle: string
): Promise<{ success: boolean; error?: string; canArchive?: boolean }> {
  try {
    const { user, profile } = await assertAdminOnlyTreatment();

    if (!id || !id.trim()) {
      return { success: false, error: 'ID de tratamiento no válido.' };
    }

    const admin = createAdminClient();

    // Obtener tratamiento completo para snapshot y validación
    const { data: treatment, error: fetchErr } = await admin
      .from('treatments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !treatment) {
      return { success: false, error: 'El tratamiento no fue encontrado.' };
    }

    if (confirmationTitle.trim().toLowerCase() !== treatment.title.trim().toLowerCase()) {
      return {
        success: false,
        error: `El nombre ingresado no coincide con "${treatment.title}". Verificá la escritura.`,
      };
    }

    // 1. Verificar dependencias previamente (integridad referencial RESTRICT)
    const { count: appCount } = await admin
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('treatment_id', id);

    if (appCount && appCount > 0) {
      return {
        success: false,
        error: `No se puede eliminar porque tiene ${appCount} cita(s) o turnos asociados. Podés pausarlo o archivarlo.`,
        canArchive: true,
      };
    }

    const { count: gcCount } = await admin
      .from('gift_cards')
      .select('*', { count: 'exact', head: true })
      .eq('treatment_id', id);

    if (gcCount && gcCount > 0) {
      return {
        success: false,
        error: `No se puede eliminar porque tiene ${gcCount} gift card(s) emitidas con este tratamiento. Podés pausarlo o archivarlo.`,
        canArchive: true,
      };
    }

    // 2. Auditoría inmutable de eliminación ANTES del borrado físico (si falla la auditoría, NO se borra)
    const actorName = profile.full_name || user.email || 'Administrador';
    const { error: auditError } = await admin.from('deletion_audit').insert({
      actor_id: user.id,
      actor_name: actorName,
      action: 'eliminado',
      entity_type: 'tratamiento',
      entity_id: id,
      entity_name: treatment.title,
      reason: 'Eliminación definitiva por Administrador en Dashboard',
      snapshot: treatment,
    });

    if (auditError) {
      console.error('[AUDIT ERROR PRE-DELETE]', auditError);
      return {
        success: false,
        error: `No se puede eliminar el tratamiento: fallo en el registro obligatorio de auditoría (${auditError.message}). Operación abortada por seguridad.`,
      };
    }

    // 3. Ejecutar borrado definitivo en PostgreSQL
    const { error: deleteError } = await admin.from('treatments').delete().eq('id', id);

    if (deleteError) {
      console.error('[DELETE ERROR]', deleteError);
      return {
        success: false,
        error: `Error al eliminar tratamiento en base de datos: ${deleteError.message}`,
      };
    }

    console.log(`[AUDIT] Tratamiento eliminado: "${treatment.title}" (ID: ${id}) por ${actorName} (${user.id})`);

    revalidatePath('/dashboard/tratamientos');
    revalidatePath('/tratamientos');
    revalidatePath('/tienda/gift-cards');

    return { success: true };
  } catch (err: any) {
    console.error('[deleteTreatment] Error:', err);
    return { success: false, error: err?.message || 'Error al procesar la eliminación.' };
  }
}

/**
 * Archivado / pausado de tratamiento con auditoría inmutable obligatoria.
 */
export async function archiveTreatment(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, profile } = await assertAdminOnlyTreatment();

    if (!id || !id.trim()) {
      return { success: false, error: 'ID de tratamiento no válido.' };
    }

    const admin = createAdminClient();

    // Obtener tratamiento antes de archivar para snapshot
    const { data: treatment, error: fetchErr } = await admin
      .from('treatments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !treatment) {
      return { success: false, error: 'Tratamiento no encontrado para archivar.' };
    }

    // 1. Registro obligatorio en deletion_audit antes de actualizar estado
    const actorName = profile.full_name || user.email || 'Administrador';
    const { error: auditError } = await admin.from('deletion_audit').insert({
      actor_id: user.id,
      actor_name: actorName,
      action: 'archivado',
      entity_type: 'tratamiento',
      entity_id: id,
      entity_name: treatment.title,
      reason: 'Archivado / pausado manual desde catálogo',
      snapshot: treatment,
    });

    if (auditError) {
      if (auditError.code === 'PGRST205') {
        console.warn('[AUDIT NOTICE] deletion_audit aún no existe en BD. Procediendo con archivado reversible.');
      } else {
        console.error('[AUDIT ERROR PRE-ARCHIVE]', auditError);
        return {
          success: false,
          error: `No se puede archivar el tratamiento: fallo en el registro obligatorio de auditoría (${auditError.message}). Operación abortada por seguridad.`,
        };
      }
    }

    // 2. Desactivar tratamiento en catálogo
    const { error: updateError } = await admin
      .from('treatments')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    console.log(`[AUDIT] Tratamiento archivado: ID ${id} por ${actorName} (${user.id})`);

    revalidatePath('/dashboard/tratamientos');
    revalidatePath('/tratamientos');
    revalidatePath('/tienda/gift-cards');

    return { success: true };
  } catch (err: any) {
    console.error('[archiveTreatment] Error:', err);
    return { success: false, error: err?.message || 'Error al archivar el tratamiento.' };
  }
}
