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

  const { error } = await admin.from('profiles').update({ role: newRole }).eq('id', userId);
  if (error) throw new Error(`No se pudo actualizar el rol: ${error.message}`);
  revalidatePath('/dashboard/usuarios');
}

export async function createStaffUser(formData: FormData) {
  await assertAdmin();

  const fullName = (formData.get('full_name') as string)?.trim();
  const email    = (formData.get('email') as string)?.trim();
  const password = (formData.get('password') as string)?.trim();
  const role     = formData.get('role') as string;

  const staffRoles = ['admin', 'medico', 'operativo', 'cosmetologa'];
  if (!fullName || !email || !password || !staffRoles.includes(role)) {
    throw new Error('Datos incompletos o rol inválido.');
  }

  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !authData.user) {
    throw new Error(`Error al crear usuario en autenticación: ${authError?.message || 'Error desconocido'}`);
  }

  // Upsert profile con email incluido (la tabla profiles tiene email NOT NULL)
  const { error: profError } = await admin
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email,
      full_name: fullName,
      role,
    });

  if (profError) {
    throw new Error(`Error al registrar perfil: ${profError.message}`);
  }

  revalidatePath('/dashboard/usuarios');
}

// ── Permisos por seccion ────────────────────────────────────────────────────
// Llamar con (userId, section, allowed) donde allowed=null quita la excepcion.
export async function setUserSectionOverride(
  userId: string,
  section: string,
  allowed: boolean | null
): Promise<void> {
  await assertAdmin();
  const admin = createAdminClient();

  if (!userId || !section) {
    throw new Error('Faltan parámetros requeridos (userId o section).');
  }

  if (allowed === null) {
    // Quitar excepcion: el usuario vuelve a heredar del rol
    const { error } = await admin
      .from("user_section_overrides")
      .delete()
      .eq("profile_id", userId)
      .eq("section", section);
    if (error) throw new Error(`No se pudo eliminar la excepción: ${error.message}`);
  } else {
    const { error } = await admin.from("user_section_overrides").upsert(
      { profile_id: userId, section, allowed },
      { onConflict: "profile_id,section" }
    );
    if (error) throw new Error(`No se pudo guardar la excepción: ${error.message}`);
  }

  revalidatePath("/dashboard/usuarios");
  revalidatePath("/dashboard");
}
