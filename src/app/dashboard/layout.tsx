// Dashboard layout — wraps all /dashboard/* pages.
// Server Component: lee sesion, rol y permisos de seccion del usuario.
// Pasa las secciones permitidas al DashboardNav (Client Component).
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardSignOut from "@/components/dashboard/DashboardSignOut";
import DashboardNav from "@/components/dashboard/DashboardNav";
import { getUserSections, serializePermissions, ALL_SECTIONS } from "@/lib/permissions";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Panel | Dra. Landaburo",
  robots: { index: false },
};

const STAFF_ROLES = ["admin", "medico", "operativo", "cosmetologa"];

// Labels legibles para cada seccion
const SECTION_LABELS: Record<string, string> = {
  ejecutivo:       "Ejecutivo",
  operativo:       "Operativo",
  "cierre-diario": "Cierre Diario",
  campanas:        "Campañas",
  tratamientos:    "Tratamientos",
  productos:       "Productos",
  usuarios:        "Usuarios",
  blog:            "Blog",
  revision:        "Revisión",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as string | undefined) ?? "paciente";

  // Pacientes no tienen acceso al dashboard
  if (!STAFF_ROLES.includes(role)) redirect("/portal/paciente");

  // Calcular secciones permitidas (cacheable por request)
  const perms = await getUserSections(user.id, role);

  // Construir nav items en el orden canónico.
  // Reestructura Ejecutivo (Punto A): 'cierre-diario' y 'revision' ahora son pestañas
  // de Ejecutivo y desaparecen como ítems de primer nivel en el sidebar.
  // Si el usuario no tiene acceso a Ejecutivo completo pero sí a Cierre Diario (ej: rol operativo),
  // se muestra 'Cierre Diario' direccionando a su pestaña en /dashboard/ejecutivo?tab=cierre-diario.
  const hasEjecutivo = perms.allowed.has("ejecutivo");
  const hasCierreDiario = perms.allowed.has("cierre-diario");

  const navItems: { href: string; label: string }[] = [];

  for (const s of ALL_SECTIONS) {
    if (s === "cierre-diario" || s === "revision") {
      continue;
    }

    if (s === "ejecutivo") {
      if (hasEjecutivo) {
        navItems.push({
          href: "/dashboard/ejecutivo",
          label: SECTION_LABELS.ejecutivo ?? "Ejecutivo",
        });
      } else if (hasCierreDiario) {
        navItems.push({
          href: "/dashboard/ejecutivo?tab=cierre-diario",
          label: "Cierre Diario",
        });
      }
      continue;
    }

    if (perms.allowed.has(s)) {
      navItems.push({
        href: `/dashboard/${s}`,
        label: SECTION_LABELS[s] ?? s,
      });
    }
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.sidebarLogo}>
            Dra. Landaburo
          </Link>
          <span className={styles.sidebarBadge}>Panel</span>
        </div>

        <DashboardNav items={navItems} />

        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.sidebarHomeLink}>
            Sitio público
          </Link>
          <DashboardSignOut />
        </div>
      </aside>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
