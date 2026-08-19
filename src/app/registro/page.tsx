import type { Metadata } from 'next';
import Link from 'next/link';
import RegisterForm from '@/components/auth/RegisterForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Crear cuenta | Dra. Landaburo',
  robots: { index: false },
};

export default function RegistroPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            Dra. Landaburo
          </Link>
          <p className={styles.subtitle}>Creá tu cuenta de paciente</p>
        </div>

        <RegisterForm />
      </div>
    </main>
  );
}
