'use client';
// AddToCartButton — botón reutilizable de agregar al carrito con tope de stock disponible.
import { useState, useRef, useEffect } from 'react';
import { useCart } from '@/contexts/CartContext';
import { trackAddToCart } from '@/lib/tracking';
import type { Product } from '@/lib/types/product';
import styles from './AddToCartButton.module.css';

export default function AddToCartButton({ product }: { product: Product }) {
  const { items, hydrated, addItem } = useCart();
  const [added, setAdded] = useState(false);
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

  const handleAdd = () => {
    if (outOfStock) return;
    const result = addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price_ars: product.price_ars,
      image_url: product.image_url,
      max_stock: maxStock,
    });
    if (result.addedQuantity <= 0) {
      setAdded(false);
      return;
    }
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
    timerRef.current = setTimeout(() => setAdded(false), 1800);
  };

  return (
    <button
      type="button"
      className={`${styles.btn} ${added ? styles.btnAdded : ''}`}
      onClick={handleAdd}
      disabled={outOfStock}
      aria-disabled={atMaxStock && !added ? true : undefined}
      aria-live="polite"
      aria-label={
        outOfStock
          ? 'Producto sin stock'
          : added
          ? 'Producto agregado al carrito'
          : atMaxStock
          ? `${product.name}: ya tenés en el carrito todas las unidades disponibles`
          : `Agregar ${product.name} al carrito`
      }
    >
      {outOfStock
        ? 'Sin stock'
        : added
        ? '¡Agregado!'
        : atMaxStock
        ? 'Ya tenés en el carrito todas las unidades disponibles'
        : 'Agregar al carrito'}
    </button>
  );
}
