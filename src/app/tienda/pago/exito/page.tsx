// Página de pago exitoso — redirige aquí MercadoPago tras un pago aprobado.
// auto_return: 'approved' en la preferencia MP asegura que llega automáticamente.
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { buildStoreWhatsappUrl } from '@/lib/storeWhatsapp';
import styles from '../pago.module.css';

export const metadata: Metadata = {
  title: 'Pago exitoso | Tienda',
  robots: { index: false },
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = {
  order_id?: string;
  external_reference?: string;
  gift_card?: string;
};

export default async function PagoExitoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { order_id, external_reference, gift_card } = await searchParams;
  const candidateOrderId = (order_id || external_reference || '').trim();
  const isGiftCard = Boolean(
    gift_card || candidateOrderId.startsWith('giftcard:')
  );

  let orderNumber: string | null = null;
  let deliveryMethod: string = 'retiro';
  let pickupAddress: string | null = null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isGiftCard && supabaseUrl && serviceKey) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey);
      const [orderRes, scRes] = await Promise.all([
        UUID_REGEX.test(candidateOrderId)
          ? supabaseAdmin
              .from('orders')
              .select('order_number, delivery_method')
              .eq('id', candidateOrderId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from('store_config')
          .select('pickup_address')
          .eq('id', 1)
          .maybeSingle(),
      ]);

      if (orderRes.data?.order_number) {
        orderNumber = orderRes.data.order_number;
      }
      if (orderRes.data?.delivery_method) {
        deliveryMethod = orderRes.data.delivery_method;
      }
      if (scRes.data?.pickup_address) {
        pickupAddress = scRes.data.pickup_address;
      }
    } catch {
      // Si la consulta opcional falla, mostramos igual la confirmación con mensaje genérico
    }
  }

  const whatsappMessage = isGiftCard
    ? 'Hola, acabo de comprar una Gift Card y quiero coordinar la entrega'
    : orderNumber
    ? `Hola, quiero coordinar el retiro de mi pedido ${orderNumber}`
    : 'Hola, quiero coordinar el retiro de mi pedido';

  const whatsappUrl = buildStoreWhatsappUrl(whatsappMessage);

  return (
    <>
      <Header />
      <main className={styles.wrapper}>
        <div className={styles.card}>
          <div className={`${styles.icon} ${styles.iconSuccess}`} aria-hidden="true">
            ✓
          </div>
          <h1 className={styles.title}>¡Pago confirmado!</h1>
          {orderNumber && (
            <p className={styles.orderBadge}>Pedido {orderNumber}</p>
          )}
          <p className={styles.text}>
            {isGiftCard
              ? 'Tu compra fue recibida correctamente. Te enviamos un email con los detalles de tu Gift Card.'
              : 'Tu pedido fue recibido correctamente. Te enviamos un email de confirmación con el detalle de tu compra.'}
          </p>

          {!isGiftCard && deliveryMethod !== 'envio' ? (
            <div className={styles.pickupCallout}>
              {pickupAddress && (
                <p className={styles.pickupAddressLine}>
                  <strong>📍 Retiro en consultorio:</strong> {pickupAddress}
                </p>
              )}
              <p className={styles.pickupPrompt}>
                Escribinos por WhatsApp para coordinar el día y horario de retiro.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnWhatsapp}
              >
                Contactar por WhatsApp
              </a>
            </div>
          ) : (
            <div className={styles.pickupCallout}>
              <p className={styles.pickupPrompt}>
                Escribinos por WhatsApp para coordinar la entrega.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnWhatsapp}
              >
                Contactar por WhatsApp
              </a>
            </div>
          )}

          <div className={styles.actions}>
            <Link href="/tienda" className={styles.btnPrimary}>
              Seguir comprando
            </Link>
            <Link href="/" className={styles.btnSecondary}>
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
