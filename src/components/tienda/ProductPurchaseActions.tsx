'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { trackAddToCart } from '@/lib/tracking';
import type { Product } from '@/lib/types/product';
import styles from './ProductPurchaseActions.module.css';

export default function ProductPurchaseActions({ product }: { product: Product }) {
  const { items, hydrated, addItem } = useCart();
  const maxStock = Math.max(0, product.stock_quantity ?? 0);
  const outOfStock = maxStock === 0;
  const isLastUnit = maxStock === 1;
  const [quantity, setQuantity] = useState(1);
  const [limitFeedbackCount, setLimitFeedbackCount] = useState(0);

  const inCartQty = hydrated ? (items.find((i) => i.id === product.id)?.quantity ?? 0) : 0;
  const remainingForCart = Math.max(0, maxStock - inCartQty);
  const atMaxStockInCart = !outOfStock && remainingForCart === 0;

  const safeQty = Math.min(Math.max(1, quantity), Math.max(1, maxStock));
  const buyNowHref = `/tienda/comprar?producto=${encodeURIComponent(product.slug)}&cantidad=${safeQty}`;

  const handleAddToCart = () => {
    if (outOfStock) return;
    const result = addItem(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price_ars: product.price_ars,
        image_url: product.image_url,
        max_stock: maxStock,
      },
      safeQty
    );

    if (result.addedQuantity <= 0) {
      setLimitFeedbackCount((c) => c + 1);
      return;
    }

    setLimitFeedbackCount(0);
    trackAddToCart({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price_ars: product.price_ars,
      category: product.category,
      quantity: result.addedQuantity,
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.stockRow}>
        {outOfStock ? (
          <span className={styles.outOfStock}>Sin stock</span>
        ) : isLastUnit ? (
          <span className={styles.lastUnitBadge}>
            <span className={styles.lastUnitDot} aria-hidden="true" />
            Última unidad disponible
          </span>
        ) : (
          <span className={styles.inStock}>En stock</span>
        )}
      </div>

      {!outOfStock && maxStock > 1 && (
        <div className={styles.qtyRow}>
          <span className={styles.qtyLabel}>Cantidad</span>
          <div className={styles.qtyStepper}>
            <button
              type="button"
              className={styles.qtyBtn}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={safeQty <= 1}
              aria-label="Disminuir cantidad"
            >
              −
            </button>
            <span className={styles.qtyValue}>{safeQty}</span>
            <button
              type="button"
              className={styles.qtyBtn}
              onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
              disabled={safeQty >= maxStock}
              aria-label="Aumentar cantidad"
            >
              +
            </button>
          </div>
          <span className={styles.availableHint}>({maxStock} disponibles)</span>
        </div>
      )}

      <div className={styles.buttonsStack}>
        {outOfStock ? (
          <button type="button" className={styles.buyNowBtn} disabled>
            Sin stock
          </button>
        ) : (
          <Link href={buyNowHref} className={styles.buyNowBtn}>
            Comprar ahora
          </Link>
        )}

        <button
          type="button"
          key={limitFeedbackCount > 0 ? `ficha-limit-${limitFeedbackCount}` : 'ficha-normal'}
          className={`${styles.addCartBtn} ${
            atMaxStockInCart ? styles.addCartBtnAtLimit : ''
          } ${limitFeedbackCount > 0 ? styles.addCartBtnPulse : ''}`}
          onClick={handleAddToCart}
          disabled={outOfStock}
          aria-disabled={atMaxStockInCart ? true : undefined}
          aria-live="polite"
          aria-label={
            outOfStock
              ? 'Producto sin stock'
              : atMaxStockInCart
              ? `${product.name}: ya tenés en el carrito todas las unidades disponibles`
              : `Agregar ${product.name} al carrito`
          }
        >
          {outOfStock
            ? 'Sin stock'
            : atMaxStockInCart
            ? 'Ya tenés en el carrito todas las unidades disponibles'
            : 'Agregar al carrito'}
        </button>

        {atMaxStockInCart && (
          <p className={styles.limitNoticeRow} role="status" aria-live="polite">
            <span>
              Tenés {inCartQty} de {maxStock}{' '}
              {maxStock === 1 ? 'unidad disponible' : 'unidades disponibles'} en tu carrito.
            </span>{' '}
            <Link href="/tienda/carrito" className={styles.limitNoticeLink}>
              Ver carrito →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
