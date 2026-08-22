'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') redirect('/dashboard/operativo');
  return user;
}

export async function changeUserRole(formData: FormData) {
  await assertAdmin();

  const userId = formData.get('userId') as string;
  const newRole = formData.get('role') as string;

  const validRoles = ['admin', 'medico', 'operativo', 'cosmetologa', 'paciente'];
  if (!userId || !validRoles.includes(newRole)) return;

  const admin = createAdminClient();

  if (newRole !== 'admin') {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (targetProfile?.role === 'admin' && (count ?? 0) <= 1) return;
  }

  await admin.from('profiles').update({ role: newRole }).eq('id', userId);
  revalidatePath('/dashboard/usuarios');
}

export async function createStaffUser(formData: FormData) {
  await assertAdmin();

  const fullName = (formData.get('full_name') as string)?.trim();
  const email    = (formData.get('email') as string)?.trim();
  const password = (formData.get('password') as string)?.trim();
  const role     = formData.get('role') as string;

  const staffRoles = ['admin', 'medico', 'operativo', 'cosmetologa'];
  if (!fullName || !email || !password || !staffRoles.includes(role)) return;

  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !authData.user) return;

  // Upsert profile con email incluido (la tabla profiles tiene email NOT NULL)
  await admin
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email,
      full_name: fullName,
      role,
    });

  revalidatePath('/dashboard/usuarios');
}
