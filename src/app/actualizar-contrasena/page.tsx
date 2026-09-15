import type { Metadata } from 'next';
import Link from 'next/link';
import ActualizarPasswordForm from '@/components/auth/ActualizarPasswordForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Establecer Nueva Contraseña | Dra. Landaburo',
  robots: { index: false },
};

export default function ActualizarContrasenaPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            Dra. Landaburo
          </Link>
          <p className={styles.subtitle}>Nueva Contraseña</p>
        </div>

        <ActualizarPasswordForm />
      </div>
    </main>
  );
}
