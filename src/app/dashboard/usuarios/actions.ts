'use server';
// Server Actions para gestión de usuarios — solo ejecutables desde el servidor.
// Requieren SUPABASE_SERVICE_ROLE_KEY (admin client) para:
//   - Cambiar roles de profiles (bypasea RLS de "solo admin puede actualizar").
//   - Crear usuarios de staff via auth.admin.createUser (no requiere email confirmation).
import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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

  const admin = getAdminClient();

  // Verificar que no se está degradando el único admin
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

  const admin = getAdminClient();

  // Crea el usuario en auth sin requerir confirmación de email
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !authData.user) return;

  // El trigger handle_new_user ya crea el profile con role='paciente'.
  // Actualizamos el role y full_name al valor deseado.
  await admin
    .from('profiles')
    .update({ role, full_name: fullName })
    .eq('id', authData.user.id);

  revalidatePath('/dashboard/usuarios');
}
