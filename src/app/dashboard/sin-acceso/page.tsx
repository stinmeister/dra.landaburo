import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './sin-acceso.module.css';

export const metadata: Metadata = {
  title: 'Sin Secciones Asignadas | Panel Dra. Landaburo',
};

export default function SinAccesoPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>🔒</div>
        <h1 className={styles.title}>Sin Secciones Asignadas</h1>
        <p className={styles.description}>
          Tu usuario está autenticado como miembro del equipo, pero actualmente no tiene secciones
          habilitadas en el panel de control.
        </p>
        <p className={styles.help}>
          Si creés que esto es un error, por favor comunicate con un administrador para que configure
          tus permisos de acceso.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.homeBtn}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
