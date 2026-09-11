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
  ejecutivo:    "Ejecutivo",
  operativo:    "Operativo",
  campanas:     "Campanas",
  tratamientos: "Tratamientos",
  productos:    "Productos",
  usuarios:     "Usuarios",
  blog:         "Blog",
  revision:     "Revisión",
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
  const serialized = serializePermissions(perms);

  // Construir nav items en el orden canonico (ALL_SECTIONS ya incluye revision de forma unificada)
  const navItems = ALL_SECTIONS
    .filter((s) => perms.allowed.has(s))
    .map((s) => ({
      href: `/dashboard/${s}`,
      label: SECTION_LABELS[s] ?? s,
    }));

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
            Sitio publico
          </Link>
          <DashboardSignOut />
        </div>
      </aside>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
