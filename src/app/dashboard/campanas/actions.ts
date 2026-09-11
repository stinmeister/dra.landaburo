'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

async function assertStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  const allowedRoles = ['admin', 'medico', 'operativo', 'cosmetologa'];
  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new Error('No autorizado');
  }

  return { user, profile };
}

async function assertAdmin() {
  const { profile } = await assertStaff();
  if (profile.role !== 'admin') {
    throw new Error('Solo administradores pueden modificar campañas.');
  }
  return profile;
}

export async function saveCampaign(formData: FormData) {
  await assertAdmin();

  const id = (formData.get('id') as string)?.trim() || null;
  const title = (formData.get('title') as string)?.trim();
  const platform = (formData.get('platform') as string)?.trim() || 'Meta Ads';
  const status = (formData.get('status') as string)?.trim() || 'activa';
  const ad_copy = (formData.get('ad_copy') as string)?.trim() || null;
  const target_treatment = (formData.get('target_treatment') as string)?.trim() || null;
  const promo_details = (formData.get('promo_details') as string)?.trim() || null;
  const suggested_response = (formData.get('suggested_response') as string)?.trim() || null;
  const start_date = (formData.get('start_date') as string)?.trim() || null;
  const end_date = (formData.get('end_date') as string)?.trim() || null;
  const utm_campaign = (formData.get('utm_campaign') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!title) {
    throw new Error('El título de la campaña es obligatorio.');
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const payload = {
    title,
    platform,
    status,
    ad_copy,
    target_treatment,
    promo_details,
    suggested_response,
    start_date,
    end_date,
    utm_campaign,
    notes,
    updated_at: now,
  };

  if (id) {
    const { error } = await admin.from('ad_campaigns').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from('ad_campaigns').insert({
      ...payload,
      created_at: now,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath('/dashboard/campanas');
  revalidatePath('/dashboard/operativo');
  return { success: true };
}

export async function toggleCampaignStatus(id: string, newStatus: 'activa' | 'pausada' | 'finalizada') {
  await assertAdmin();
  if (!id) throw new Error('ID requerido');

  const admin = createAdminClient();
  const { error } = await admin
    .from('ad_campaigns')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/campanas');
  revalidatePath('/dashboard/operativo');
  return { success: true };
}

export async function deleteCampaign(formData: FormData) {
  await assertAdmin();
  const id = formData.get('id') as string;
  if (!id) throw new Error('ID requerido');

  const admin = createAdminClient();
  const { error } = await admin.from('ad_campaigns').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/campanas');
  revalidatePath('/dashboard/operativo');
  return { success: true };
}
