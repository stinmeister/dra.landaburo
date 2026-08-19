'use client';
// CartIcon — reemplaza el <button> estático del Header.
// Muestra badge con conteo cuando hay items. El ícono SVG inline evita
// dependencias de Lucide que podrían no estar disponibles en el isolated world del cart.
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import styles from './CartIcon.module.css';

export default function CartIcon() {
  const { totalItems } = useCart();
  return (
    <Link
      href="/tienda/carrito"
      className={styles.cartLink}
      aria-label={`Carrito (${totalItems} ${totalItems === 1 ? 'item' : 'items'})`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {totalItems > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </Link>
  );
}
