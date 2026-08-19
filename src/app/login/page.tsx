// Server Component — renders the login page shell.
// The actual form logic lives in LoginForm (Client Component) because it
// needs browser-side state and the Supabase browser client.
import type { Metadata } from 'next';
import Link from 'next/link';
import LoginForm from '@/components/auth/LoginForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Ingresar | Dra. Landaburo',
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            Dra. Landaburo
          </Link>
          <p className={styles.subtitle}>Accedé a tu cuenta</p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
