'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CartItem } from '@/contexts/CartContext';
import styles from './AddedToCartSheet.module.css';

export interface AddedCartNoticeData {
  id: string;
  slug: string;
  name: string;
  price_ars: number;
  image_url: string | null;
  addedQuantity: number;
  cappedByStock?: boolean;
}

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

interface Props {
  notice: AddedCartNoticeData | null;
  items: CartItem[];
  totalItemsInCart: number;
  totalARS: number;
  onDismiss: () => void;
}

export default function AddedToCartSheet({
  notice,
  items,
  totalItemsInCart,
  totalARS,
  onDismiss,
}: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!notice) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notice, onDismiss]);

  const orderedItems = useMemo(() => {
    if (!notice) return items;
    if (items.length === 0) {
      return [
        {
          id: notice.id,
          slug: notice.slug,
          name: notice.name,
          price_ars: notice.price_ars,
          image_url: notice.image_url,
          quantity: notice.addedQuantity,
        },
      ];
    }
    const justAdded = items.find((i) => i.id === notice.id);
    const others = items.filter((i) => i.id !== notice.id);
    return justAdded ? [justAdded, ...others] : items;
  }, [items, notice]);

  if (!notice) return null;

  const computedTotalARS =
    totalARS > 0
      ? totalARS
      : orderedItems.reduce((sum, i) => sum + i.price_ars * i.quantity, 0);
  const computedTotalQty =
    totalItemsInCart > 0
      ? totalItemsInCart
      : orderedItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      <div className={styles.backdrop} onClick={onDismiss} aria-hidden="true" />
      <aside
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Agregaste a tu carrito"
      >
        <div className={styles.headerBlock}>
          <div className={styles.grabHandle} aria-hidden="true" />
          <div className={styles.header}>
            <div className={styles.titleGroup}>
              <span className={styles.checkBadge} aria-hidden="true">
                ✓
              </span>
              <div>
                <h2 className={styles.title}>Agregaste a tu carrito</h2>
                <p className={styles.headerSubnote}>
                  {computedTotalQty === 1
                    ? '1 unidad en tu carrito'
                    : `${computedTotalQty} unidades en tu carrito`}
                </p>
              </div>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onDismiss}
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </div>

          {notice.cappedByStock && (
            <p className={styles.stockCapNotice} role="status">
              Se alcanzó el stock máximo disponible de {notice.name}.
            </p>
          )}
        </div>

        <ul className={styles.itemsList} aria-label="Productos en tu carrito">
          {orderedItems.map((item) => {
            const isRecent = item.id === notice.id;
            const subtotal = item.price_ars * item.quantity;
            return (
              <li
                key={item.id}
                className={`${styles.productRow} ${
                  isRecent ? styles.productRowHighlighted : ''
                }`}
              >
                <div className={styles.imageBox}>
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      className={styles.image}
                      sizes="68px"
                    />
                  ) : (
                    <div className={styles.imageFallback} />
                  )}
                </div>

                <div className={styles.productInfo}>
                  {isRecent && (
                    <span className={styles.recentBadge}>Recién agregado</span>
                  )}
                  <p className={styles.productName}>{item.name}</p>
                  <p className={styles.productMeta}>
                    {item.quantity === 1
                      ? 'Cantidad: 1 unidad'
                      : `Cantidad: ${item.quantity} unidades · ${formatARS(item.price_ars)} c/u`}
                  </p>
                </div>

                <p className={styles.productSubtotal}>{formatARS(subtotal)}</p>
              </li>
            );
          })}
        </ul>

        <div className={styles.footerBlock}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalAmount}>{formatARS(computedTotalARS)}</span>
          </div>

          <div className={styles.actions}>
            <Link
              href="/tienda/carrito"
              className={styles.primaryBtn}
              onClick={() => {
                if (pathname === '/tienda/carrito') onDismiss();
              }}
            >
              Ir al carrito
            </Link>
            <button type="button" className={styles.secondaryBtn} onClick={onDismiss}>
              Seguir comprando
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
