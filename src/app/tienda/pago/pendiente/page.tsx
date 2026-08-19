// Página de pago pendiente — MercadoPago redirige aquí cuando el pago está en proceso
// (ej. transferencia bancaria, efectivo en puntos de pago).
import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../pago.module.css';

export const metadata: Metadata = {
  title: 'Pago pendiente | Tienda Dra. Landaburo',
  robots: { index: false },
};

export default function PagoPendientePage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={`${styles.icon} ${styles.iconPending}`} aria-hidden="true">⏳</div>
        <h1 className={styles.title}>Pago en proceso</h1>
        <p className={styles.text}>
          Tu pedido está registrado pero el pago aún está siendo procesado.
          Te notificaremos por email cuando se confirme.
        </p>
        <p className={styles.text}>
          No hace falta que hagas nada más. Podés consultar el estado de tu pedido
          contactándonos por WhatsApp.
        </p>
        <div className={styles.actions}>
          <Link href="/tienda" className={styles.btnPrimary}>
            Volver a la tienda
          </Link>
          <Link href="/" className={styles.btnSecondary}>
            Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
