// Dashboard layout — wraps all /dashboard/* pages.
// Sidebar + main content area. The sidebar is a Server Component (static nav),
// the sign-out button is inside a small Client Component to keep the logout
// action browser-side.
import type { Metadata } from 'next';
import Link from 'next/link';
import DashboardSignOut from '@/components/dashboard/DashboardSignOut';
import styles from './layout.module.css';

export const metadata: Metadata = {
  title: 'Panel | Dra. Landaburo',
  robots: { index: false },
};

const navItems = [
  { href: '/dashboard/ejecutivo', label: 'Ejecutivo' },
  { href: '/dashboard/operativo', label: 'Operativo' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
