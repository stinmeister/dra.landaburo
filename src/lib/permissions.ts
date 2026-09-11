// lib/permissions.ts
// Capa centralizada de control de acceso por seccion del dashboard.
// Modelo: defaults por rol (role_section_defaults) + excepciones por usuario (user_section_overrides).
// La excepcion sobreescribe el default: un admin puede dar o quitar secciones puntuales.
//
// USO: llamar una sola vez por request en el layout o en la page que necesite verificar.
// No llamar en cada componente hijo para evitar N+1 queries.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const ALL_SECTIONS = [
  "ejecutivo",
  "operativo",
  "campanas",
  "tratamientos",
  "productos",
  "usuarios",
  "blog",
] as const;

export type Section = (typeof ALL_SECTIONS)[number];

export interface SectionPermissions {
  allowed: Set<Section>;
  // Que secciones vienen del rol (para distinguirlas en la UI)
  fromRole: Set<Section>;
  // Que secciones tienen excepcion explicita (true o false)
  overrides: Map<Section, boolean>;
}

/**
 * Calcula el conjunto de secciones permitidas para un usuario dado su rol.
 * Usa el cliente admin para leer los defaults (evita problemas de RLS en el layout).
 * Cacheable por request: llamar una vez y pasar el resultado.
 */
export async function getUserSections(
  profileId: string,
  role: string
): Promise<SectionPermissions> {
  // admin siempre tiene acceso total sin consultar la tabla
  if (role === "admin") {
    return {
      allowed: new Set(ALL_SECTIONS),
      fromRole: new Set(ALL_SECTIONS),
      overrides: new Map(),
    };
  }

  const admin = createAdminClient();

  // 1. Defaults del rol
  const { data: defaults } = await admin
    .from("role_section_defaults")
    .select("section, allowed")
    .eq("role", role);

  // 2. Excepciones del usuario
  const { data: overrideRows } = await admin
    .from("user_section_overrides")
    .select("section, allowed")
    .eq("profile_id", profileId);

  const fromRole = new Set<Section>();
  const overrides = new Map<Section, boolean>();
  const allowed = new Set<Section>();

  // Aplicar defaults
  for (const d of defaults ?? []) {
    if (d.allowed) fromRole.add(d.section as Section);
  }

  // Aplicar overrides (sobreescriben el default)
  for (const o of overrideRows ?? []) {
    overrides.set(o.section as Section, o.allowed);
  }

  // Calcular final
  for (const section of ALL_SECTIONS) {
    const override = overrides.get(section);
    if (override !== undefined) {
      if (override) allowed.add(section);
    } else if (fromRole.has(section)) {
      allowed.add(section);
    }
  }

  return { allowed, fromRole, overrides };
}

/**
 * Verifica si un usuario puede acceder a una seccion.
 * Lanza redirect a /dashboard/operativo si no tiene permiso.
 * Para usar al principio de cada page.tsx protegida.
 */
export async function assertSectionAccess(
  profileId: string,
  role: string,
  section: Section
): Promise<void> {
  const { redirect } = await import("next/navigation");
  const perms = await getUserSections(profileId, role);
  if (!perms.allowed.has(section)) {
    redirect("/dashboard/operativo");
  }
}

/**
 * Convierte SectionPermissions a un formato serializable para pasar a Client Components.
 */
export function serializePermissions(perms: SectionPermissions) {
  return {
    allowed: Array.from(perms.allowed),
    fromRole: Array.from(perms.fromRole),
    overrides: Object.fromEntries(perms.overrides),
  };
}

export type SerializedPermissions = ReturnType<typeof serializePermissions>;
