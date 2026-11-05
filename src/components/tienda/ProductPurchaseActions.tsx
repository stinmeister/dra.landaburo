'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { trackAddToCart } from '@/lib/tracking';
import type { Product } from '@/lib/types/product';
import styles from './ProductPurchaseActions.module.css';

export default function ProductPurchaseActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const maxStock = Math.max(0, product.stock_quantity ?? 0);
  const outOfStock = maxStock === 0;
  const isLastUnit = maxStock === 1;
  const [quantity, setQuantity] = useState(1);

  const safeQty = Math.min(Math.max(1, quantity), Math.max(1, maxStock));
  const buyNowHref = `/tienda/comprar?producto=${encodeURIComponent(product.slug)}&cantidad=${safeQty}`;

  const handleAddToCart = () => {
    if (outOfStock) return;
    addItem(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price_ars: product.price_ars,
        image_url: product.image_url,
      },
      safeQty
    );
    trackAddToCart({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price_ars: product.price_ars,
      category: product.category,
      quantity: safeQty,
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
          className={styles.addCartBtn}
          onClick={handleAddToCart}
          disabled={outOfStock}
          aria-label={
            outOfStock
              ? 'Producto sin stock'
              : `Agregar ${product.name} al carrito`
          }
        >
          Agregar al carrito
        </button>
      </div>
    </div>
  );
}
