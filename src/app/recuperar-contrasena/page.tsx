import type { Metadata } from 'next';
import Link from 'next/link';
import RecuperarPasswordForm from '@/components/auth/RecuperarPasswordForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Recuperar Contraseña | Dra. Landaburo',
  robots: { index: false },
};

export default function RecuperarContrasenaPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            Dra. Landaburo
          </Link>
          <p className={styles.subtitle}>Recuperar Contraseña</p>
        </div>

        <RecuperarPasswordForm />
      </div>
    </main>
  );
}
