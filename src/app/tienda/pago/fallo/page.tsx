// Página de pago fallido — MercadoPago redirige aquí cuando el pago fue rechazado.
// Mostramos mensaje amigable y opción de reintentar.
import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../pago.module.css';

export const metadata: Metadata = {
  title: 'Pago no procesado | Tienda Dra. Landaburo',
  robots: { index: false },
};

export default function PagoFalloPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={`${styles.icon} ${styles.iconError}`} aria-hidden="true">✕</div>
        <h1 className={styles.title}>No pudimos procesar tu pago</h1>
        <p className={styles.text}>
          El pago fue rechazado. Esto puede deberse a fondos insuficientes, datos
          incorrectos o una limitación de tu banco.
        </p>
        <p className={styles.text}>
          Tu carrito sigue guardado — podés volver e intentar con otro medio de pago.
        </p>
        <div className={styles.actions}>
          <Link href="/tienda/carrito" className={styles.btnPrimary}>
            Reintentar pago
          </Link>
          <Link href="/tienda" className={styles.btnSecondary}>
            Volver a la tienda
          </Link>
        </div>
      </div>
    </div>
  );
}
