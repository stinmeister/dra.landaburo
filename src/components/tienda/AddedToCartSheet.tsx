'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AddedToCartSheet.module.css';

export interface AddedCartNoticeData {
  id: string;
  slug: string;
  name: string;
  price_ars: number;
  image_url: string | null;
  addedQuantity: number;
}

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

interface Props {
  notice: AddedCartNoticeData | null;
  totalItemsInCart: number;
  onDismiss: () => void;
}

export default function AddedToCartSheet({ notice, totalItemsInCart, onDismiss }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!notice) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={onDismiss} aria-hidden="true" />
      <aside
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Agregaste a tu carrito"
      >
        <div className={styles.topBlock}>
          <div className={styles.grabHandle} aria-hidden="true" />
          <div className={styles.header}>
            <div className={styles.titleGroup}>
              <span className={styles.checkBadge} aria-hidden="true">
                ✓
              </span>
              <h2 className={styles.title}>Agregaste a tu carrito</h2>
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

          <div className={styles.productRow}>
            <div className={styles.imageBox}>
              {notice.image_url ? (
                <Image
                  src={notice.image_url}
                  alt={notice.name}
                  fill
                  className={styles.image}
                  sizes="76px"
                />
              ) : (
                <div className={styles.imageFallback} />
              )}
            </div>
            <div className={styles.productInfo}>
              <p className={styles.productName}>{notice.name}</p>
              <p className={styles.productMeta}>
                {notice.addedQuantity === 1
                  ? '1 unidad'
                  : `${notice.addedQuantity} unidades`}
              </p>
              <p className={styles.productPrice}>
                {formatARS(notice.price_ars * notice.addedQuantity)}
              </p>
            </div>
          </div>

          {totalItemsInCart > 0 && (
            <p className={styles.cartSummaryNote}>
              {totalItemsInCart === 1
                ? 'Tenés 1 producto en tu carrito.'
                : `Tenés ${totalItemsInCart} productos en tu carrito.`}
            </p>
          )}
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
      </aside>
    </>
  );
}
