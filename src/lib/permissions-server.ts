import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getUserSections,
  type PermissionsDbClient,
  type Section,
} from "@/lib/permissions";

export interface RequireSectionAccessDeps {
  getAuthUser?: () => Promise<{ id: string } | null>;
  adminClient?: PermissionsDbClient;
}

/**
 * Verifica en el servidor (para Server Actions o Route Handlers) que el usuario
 * autenticado tenga permiso efectivo sobre `section` reutilizando `getUserSections`
 * de `@/lib/permissions`.
 * Si no está autenticado o no tiene permiso, lanza un Error explícito.
 */
export async function requireSectionAccess(
  section: Section,
  deps?: RequireSectionAccessDeps
): Promise<{ userId: string; role: string }> {
  let user: { id: string } | null = null;
  if (deps?.getAuthUser) {
    user = await deps.getAuthUser();
  } else {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser ? { id: authUser.id } : null;
  }

  if (!user?.id) {
    throw new Error("No autenticado");
  }

  const admin =
    deps?.adminClient ?? (createAdminClient() as unknown as PermissionsDbClient);
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profileErr || !profile?.role) {
    throw new Error(
      `Acceso denegado: no se pudo verificar el rol para la sección '${section}'`
    );
  }

  const perms = await getUserSections(user.id, profile.role, admin);
  if (!perms.allowed.has(section)) {
    throw new Error(
      `Acceso denegado: no tenés permiso para operar en la sección '${section}'`
    );
  }

  return { userId: user.id, role: profile.role };
}
