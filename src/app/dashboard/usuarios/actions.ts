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
  const role     = formData.get('role') as string;

  const staffRoles = ['admin', 'medico', 'operativo', 'cosmetologa'];
  if (!fullName || !email || !staffRoles.includes(role)) {
    throw new Error('Datos incompletos o rol inválido.');
  }

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dralandaburo.com';
  const redirectTo = `${siteUrl}/actualizar-contrasena`;

  // Invitar al usuario por correo electrónico para que defina su propia clave
  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });

  let userId = authData?.user?.id;

  if (authError || !userId) {
    // Si el usuario ya existía en auth, buscar su id para actualizar su rol
    const { data: listData } = await admin.auth.admin.listUsers();
    const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      userId = existing.id;
    } else {
      throw new Error(`Error al invitar usuario: ${authError?.message || 'Error desconocido'}`);
    }
  }

  // Upsert profile con email incluido
  const { error: profError } = await admin
    .from('profiles')
    .upsert({
      id: userId,
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

// ── Gestión Segura de Recuperación de Contraseñas (Solo Enlaces y Correo) ────
// SEGURIDAD (17/09/2026): Eliminada la asignación manual directa de contraseñas
// para prevenir suplantación de identidad. Solo se permite el envío de enlaces
// al correo registrado del usuario o la generación del enlace oficial de recuperación.

export async function adminSendRecoveryEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  await assertAdmin();

  if (!email) {
    return { success: false, error: 'Email no válido.' };
  }

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dralandaburo.com';
  const redirectTo = `${siteUrl}/auth/callback?next=/actualizar-contrasena`;

  const { error } = await admin.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });

  if (error) {
    return { success: false, error: `Error al enviar correo: ${error.message}` };
  }

  return { success: true };
}

