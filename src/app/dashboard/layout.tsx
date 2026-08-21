// Dashboard layout — wraps all /dashboard/* pages.
// Server Component: lee la sesión y el rol del usuario para:
//   1. Redirigir a /login si no hay sesión.
//   2. Redirigir a /portal/paciente si el rol es 'paciente' (sin acceso al dashboard).
//   3. Renderizar un sidebar con los ítems de nav correspondientes al rol.
//      admin → todos los módulos
//      medico / operativo / cosmetologa → solo Operativo
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DashboardSignOut from '@/components/dashboard/DashboardSignOut';
import styles from './layout.module.css';

export const metadata: Metadata = {
  title: 'Panel | Dra. Landaburo',
  robots: { index: false },
};

const STAFF_ROLES = ['admin', 'medico', 'operativo', 'cosmetologa'];

const ADMIN_NAV = [
  { href: '/dashboard/ejecutivo', label: 'Ejecutivo' },
  { href: '/dashboard/operativo', label: 'Operativo' },
  { href: '/dashboard/usuarios',  label: 'Usuarios' },
  { href: '/dashboard/productos', label: 'Productos' },
  { href: '/dashboard/blog',      label: 'Blog' },
];

const STAFF_NAV = [
  { href: '/dashboard/operativo', label: 'Operativo' },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const role = (profile?.role as string | undefined) ?? 'paciente';

  // Pacientes no tienen acceso al dashboard
  if (!STAFF_ROLES.includes(role)) redirect('/portal/paciente');

  const navItems = role === 'admin' ? ADMIN_NAV : STAFF_NAV;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.sidebarLogo}>
            Dra. Landaburo
          </Link>
          <span className={styles.sidebarBadge}>Panel</span>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navItem}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.sidebarHomeLink}>
            ← Sitio público
          </Link>
          <DashboardSignOut />
        </div>
      </aside>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
