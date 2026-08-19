'use client';
// AddToCartButton — botón de agregar al carrito en la página de detalle del producto.
// El feedback visual "¡Agregado!" dura 2 segundos para confirmar la acción al usuario.
import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import type { Product } from '@/lib/types/product';
import styles from './AddToCartButton.module.css';

export default function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock_quantity === 0;

  const handleAdd = () => {
    if (outOfStock || added) return;
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price_ars: product.price_ars,
      image_url: product.image_url,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <button
      className={`${styles.btn} ${added ? styles.btnAdded : ''}`}
      onClick={handleAdd}
      disabled={outOfStock || added}
      aria-live="polite"
      aria-label={
        outOfStock
          ? 'Producto sin stock'
          : added
          ? 'Producto agregado al carrito'
          : `Agregar ${product.name} al carrito`
      }
    >
      {outOfStock ? 'Sin stock' : added ? '¡Agregado!' : 'Agregar al carrito'}
    </button>
  );
}
