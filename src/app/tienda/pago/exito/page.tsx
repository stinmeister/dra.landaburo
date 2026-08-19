// Página de pago exitoso — redirige aquí MercadoPago tras un pago aprobado.
// auto_return: 'approved' en la preferencia MP asegura que llega automáticamente.
import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../pago.module.css';

export const metadata: Metadata = {
  title: 'Pago exitoso | Tienda Dra. Landaburo',
  robots: { index: false },
};

export default function PagoExitoPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={`${styles.icon} ${styles.iconSuccess}`} aria-hidden="true">✓</div>
        <h1 className={styles.title}>¡Pago confirmado!</h1>
        <p className={styles.text}>
          Tu pedido fue recibido correctamente. Te enviamos un email de confirmación
          con los detalles y las instrucciones de entrega.
        </p>
        <p className={styles.text}>
          Si tenés alguna consulta, no dudes en contactarnos por WhatsApp.
        </p>
        <div className={styles.actions}>
          <Link href="/tienda" className={styles.btnPrimary}>
            Seguir comprando
          </Link>
          <Link href="/" className={styles.btnSecondary}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
