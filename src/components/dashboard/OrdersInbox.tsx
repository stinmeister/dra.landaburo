'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { prepareOrder, deliverOrder } from '@/app/dashboard/operativo/actions';
import styles from './OrdersInbox.module.css';

export interface OrderRecord {
  id: string;
  order_number: string;
  created_at: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  total_ars: number;
  delivery_method: string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_postal_code: string | null;
  delivery_notes: string | null;
  fulfillment_status: 'pendiente' | 'preparado' | 'entregado';
  prepared_at: string | null;
  prepared_by_name: string | null;
  delivered_at: string | null;
  delivered_by_name: string | null;
  buyer_email_sent: boolean;
  buyer_email_error: string | null;
  staff_email_sent: boolean;
  staff_email_error: string | null;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price_ars: number;
  }>;
}

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function OrdersInbox({ orders }: { orders: OrderRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const handlePrepare = (orderId: string) => {
    setActiveActionId(orderId);
    startTransition(async () => {
      try {
        await prepareOrder(orderId);
        router.refresh();
      } catch (err: any) {
        alert(err?.message || 'Error al preparar el pedido');
      } finally {
        setActiveActionId(null);
      }
    });
  };

  const handleDeliver = (orderId: string) => {
    setActiveActionId(orderId);
    startTransition(async () => {
      try {
        await deliverOrder(orderId);
        router.refresh();
      } catch (err: any) {
        alert(err?.message || 'Error al entregar el pedido');
      } finally {
        setActiveActionId(null);
      }
    });
  };

  if (orders.length === 0) {
    return (
      <div className={styles.empty}>
        No hay pedidos online registrados hasta el momento.
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.ordersList}>
        {orders.map((order) => {
          const isRetiro = order.delivery_method === 'retiro';
          const isActing = activeActionId === order.id && isPending;

          return (
            <article key={order.id} className={styles.orderCard}>
              <div className={styles.cardTop}>
                <div className={styles.orderHeader}>
                  <span className={styles.orderNumber}>{order.order_number}</span>
                  <span className={styles.orderDate}>{formatDateTime(order.created_at)} hs</span>
                </div>

                <div className={styles.statusBadges}>
                  <span
                    className={`${styles.badge} ${
                      isRetiro ? styles.deliveryBadgeRetiro : styles.deliveryBadgeEnvio
                    }`}
                  >
                    {isRetiro ? '📍 Retiro' : '📦 Envío'}
                  </span>

                  {order.fulfillment_status === 'pendiente' && (
                    <span className={`${styles.badge} ${styles.badgePending}`}>
                      Pendiente
                    </span>
                  )}
                  {order.fulfillment_status === 'preparado' && (
                    <span className={`${styles.badge} ${styles.badgePrepared}`}>
                      Preparado
                    </span>
                  )}
                  {order.fulfillment_status === 'entregado' && (
                    <span className={`${styles.badge} ${styles.badgeDelivered}`}>
                      Entregado
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.cardBody}>
                {/* Compradora & Entrega */}
                <div className={styles.buyerInfo}>
                  <div className={styles.buyerName}>{order.buyer_name}</div>
                  <div className={styles.buyerContact}>
                    <span>{order.buyer_email}</span>
                    {order.buyer_phone && (
                      <a
                        href={`https://wa.me/${order.buyer_phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.waBtn}
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>

                  {!isRetiro && (
                    <div className={styles.deliveryDetails}>
                      <strong>Dirección de entrega:</strong>
                      <br />
                      {order.delivery_address || 'No especificada'} — {order.delivery_city || ''}{' '}
                      {order.delivery_postal_code ? `(CP ${order.delivery_postal_code})` : ''}
                      {order.delivery_notes && (
                        <div>
                          <em>Nota: {order.delivery_notes}</em>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Estado de Emails */}
                  <div className={styles.emailStatusRow}>
                    <span>Mails de confirmación:</span>
                    {order.buyer_email_sent && order.staff_email_sent ? (
                      <span className={styles.emailOk}>Enviados ✓</span>
                    ) : (
                      <span
                        className={styles.emailError}
                        title={`Compradora: ${order.buyer_email_error || 'OK'} | Staff: ${
                          order.staff_email_error || 'OK'
                        }`}
                      >
                        Error en envío ⚠️
                      </span>
                    )}
                  </div>
                </div>

                {/* Detalle de Productos */}
                <div className={styles.itemsInfo}>
                  <div className={styles.itemsTitle}>Productos</div>
                  <ul className={styles.itemList}>
                    {order.items.map((it) => (
                      <li key={it.id} className={styles.itemRow}>
                        <span>
                          {it.quantity}x {it.product_name}
                        </span>
                        <span>{formatARS(it.unit_price_ars * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className={styles.orderTotal}>
                    <span>Total pagado:</span>
                    <span>{formatARS(order.total_ars)}</span>
                  </div>
                </div>
              </div>

              {/* Footer con Autoría y Acciones */}
              <div className={styles.cardFooter}>
                <div className={styles.authorshipText}>
                  {order.fulfillment_status === 'pendiente' && (
                    <span>Aguardando armado del pedido por el equipo.</span>
                  )}
                  {order.fulfillment_status === 'preparado' && (
                    <span>
                      Preparado por <strong>{order.prepared_by_name || 'Personal'}</strong>
                      {order.prepared_at ? ` el ${formatDateTime(order.prepared_at)} hs` : ''}. Listo para entregar.
                    </span>
                  )}
                  {order.fulfillment_status === 'entregado' && (
                    <span>
                      Preparado por <strong>{order.prepared_by_name || 'Personal'}</strong> · Entregado por{' '}
                      <strong>{order.delivered_by_name || 'Personal'}</strong>
                      {order.delivered_at ? ` el ${formatDateTime(order.delivered_at)} hs` : ''}.
                    </span>
                  )}
                </div>

                <div>
                  {order.fulfillment_status === 'pendiente' && (
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.btnPrepare}`}
                      onClick={() => handlePrepare(order.id)}
                      disabled={isActing}
                    >
                      {isActing ? 'Guardando...' : 'Marcar como preparado'}
                    </button>
                  )}

                  {order.fulfillment_status === 'preparado' && (
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.btnDeliver}`}
                      onClick={() => handleDeliver(order.id)}
                      disabled={isActing}
                    >
                      {isActing ? 'Guardando...' : 'Marcar como entregado'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
