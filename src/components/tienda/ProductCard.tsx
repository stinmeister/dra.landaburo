'use client';
// ProductCard — tarjeta de producto para la grilla de la tienda.
// Toda la tarjeta es clickeable mediante un único <Link> accesible (stretched link),
// mientras que el botón "Agregar al carrito" queda fuera del <a> y nunca propaga navegación.
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { trackAddToCart } from '@/lib/tracking';
import type { Product } from '@/lib/types/product';
import styles from './ProductCard.module.css';

export const formatARS = (n: number | string | undefined | null) => {
  if (n === null || n === undefined || n === '') return 'A consultar';
  const num = typeof n === 'number' ? n : parseFloat(String(n || 0));
  if (isNaN(num) || num <= 0) return 'A consultar';
  return `$ ${Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
};

export default function ProductCard({ product }: { product: Product }) {
  const { items, hydrated, addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [limitFeedbackCount, setLimitFeedbackCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const maxStock = Math.max(0, product.stock_quantity ?? 0);
  const outOfStock = maxStock === 0;
  const inCartQty = hydrated ? (items.find((i) => i.id === product.id)?.quantity ?? 0) : 0;
  const atMaxStock = !outOfStock && inCartQty >= maxStock;

  const hasDiscount =
    product.compare_price_ars != null && product.compare_price_ars > product.price_ars;

  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
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
      1
    );

    if (result.addedQuantity <= 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setAdded(false);
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

    if (timerRef.current) clearTimeout(timerRef.current);
    setAdded(true);
    timerRef.current = setTimeout(() => setAdded(false), 1600);
  };

  const buttonLabel = outOfStock
    ? 'Sin stock'
    : added
    ? '✓ Agregado al carrito'
    : atMaxStock
    ? 'Ya tenés en el carrito todas las unidades disponibles'
    : 'Agregar al carrito';

  return (
    <article className={styles.card}>
      <div className={styles.imageWrapper}>
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className={styles.image}
            sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className={styles.imageFallback}>
            <span>Sin imagen</span>
          </div>
        )}
        {outOfStock && <span className={styles.outOfStockOverlay}>Sin stock</span>}
      </div>

      <div className={styles.body}>
        {product.brand_type && (
          <p className={styles.brandType}>{product.brand_type}</p>
        )}
        <h2 className={styles.name}>
          <Link href={`/tienda/${product.slug}`} className={styles.cardLink}>
            {product.name}
          </Link>
        </h2>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatARS(product.price_ars)}</span>
          {hasDiscount && (
            <span className={styles.comparePrice}>
              {formatARS(product.compare_price_ars!)}
            </span>
          )}
        </div>

        <div className={styles.actionArea}>
          <button
            type="button"
            key={limitFeedbackCount > 0 ? `limit-${limitFeedbackCount}` : 'normal'}
            className={`${styles.addBtn} ${
              atMaxStock && !added ? styles.addBtnAtLimit : ''
            } ${limitFeedbackCount > 0 ? styles.addBtnPulse : ''}`}
            onClick={handleAdd}
            disabled={outOfStock}
            aria-disabled={atMaxStock && !added ? true : undefined}
            aria-live="polite"
            aria-label={
              outOfStock
                ? `${product.name} — Sin stock`
                : added
                ? `${product.name} agregado al carrito`
                : atMaxStock
                ? `${product.name}: ya tenés en el carrito todas las unidades disponibles`
                : `Agregar ${product.name} al carrito`
            }
          >
            {buttonLabel}
          </button>

          {atMaxStock && limitFeedbackCount > 0 && (
            <p className={styles.limitNotice} role="status" aria-live="polite">
              Stock disponible: {maxStock}{' '}
              {maxStock === 1 ? 'unidad (ya está en tu carrito).' : 'unidades (ya están en tu carrito).'}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
