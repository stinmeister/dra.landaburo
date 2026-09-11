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
  const price_ars         = parseFloat(formData.get('price_ars') as string);
  const duration_minutes  = parseInt(formData.get('duration_minutes') as string, 10) || 45;
  const description       = (formData.get('description') as string)?.trim() ?? '';
  const professional_role = (formData.get('professional_role') as string)?.trim() || 'medico';

  if (!title || !category || isNaN(price_ars)) return;

  const slug = slugify(title);
  const admin = createAdminClient();

  await admin.from('treatments').insert({
    title,
    slug,
    category,
    price_ars,
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
  const price_ars         = parseFloat(formData.get('price_ars') as string);
  const duration_minutes  = parseInt(formData.get('duration_minutes') as string, 10) || 45;
  const description       = (formData.get('description') as string)?.trim() ?? '';
  const professional_role = (formData.get('professional_role') as string)?.trim() || 'medico';

  if (!id || !title || !category || isNaN(price_ars)) return;

  const admin = createAdminClient();
  await admin.from('treatments').update({
    title,
    category,
    price_ars,
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
