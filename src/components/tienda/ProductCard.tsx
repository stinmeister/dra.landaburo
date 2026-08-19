'use client';
// ProductCard — tarjeta de producto para la grilla de la tienda.
// Client Component porque usa useCart (contexto de React con estado cliente).
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import type { Product } from '@/lib/types/product';
import styles from './ProductCard.module.css';

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const outOfStock = product.stock_quantity === 0;
  const hasDiscount =
    product.compare_price_ars != null && product.compare_price_ars > product.price_ars;

  const handleAdd = () => {
    if (outOfStock) return;
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price_ars: product.price_ars,
      image_url: product.image_url,
    });
  };

  return (
    <article className={styles.card}>
      <Link href={`/tienda/${product.slug}`} className={styles.imageLink} tabIndex={-1} aria-hidden="true">
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
          {hasDiscount && <span className={styles.discountBadge}>Oferta</span>}
          {outOfStock && <span className={styles.outOfStockOverlay}>Sin stock</span>}
        </div>
      </Link>

      <div className={styles.body}>
        {product.brand_type && (
          <p className={styles.brandType}>{product.brand_type}</p>
        )}
        <Link href={`/tienda/${product.slug}`} className={styles.nameLink}>
          <h2 className={styles.name}>{product.name}</h2>
        </Link>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatARS(product.price_ars)}</span>
          {hasDiscount && (
            <span className={styles.comparePrice}>
              {formatARS(product.compare_price_ars!)}
            </span>
          )}
        </div>
        <button
          className={styles.addBtn}
          onClick={handleAdd}
          disabled={outOfStock}
          aria-label={
            outOfStock ? 'Sin stock' : `Agregar ${product.name} al carrito`
          }
        >
          {outOfStock ? 'Sin stock' : 'Agregar al carrito'}
        </button>
      </div>
    </article>
  );
}
