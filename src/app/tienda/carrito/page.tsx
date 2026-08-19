'use client';
// Página del carrito — Client Component porque depende del CartContext (localStorage).
// Incluye formulario de datos del comprador y botón de checkout con MercadoPago.
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import styles from './carrito.module.css';

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

interface BuyerForm {
  name: string;
  email: string;
  phone: string;
}

export default function CarritoPage() {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalARS } = useCart();
  const [buyer, setBuyer] = useState<BuyerForm>({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuyerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBuyer(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, buyer }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      const { init_point } = await res.json();
      // Redirigir al checkout de MercadoPago
      window.location.href = init_point;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago. Intentá de nuevo.');
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className={styles.emptyWrapper}>
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>Tu carrito está vacío</p>
          <p className={styles.emptyText}>
            Explorá la tienda y agregá los productos que necesitás.
          </p>
          <Link href="/tienda" className={styles.backLink}>
            Ver productos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <Link href="/tienda" className={styles.backLink}>
            ← Seguir comprando
          </Link>
          <h1 className={styles.title}>Tu carrito</h1>
          <span className={styles.itemCount}>
            {totalItems} {totalItems === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        <div className={styles.layout}>
          {/* Lista de items */}
          <section className={styles.itemsSection} aria-label="Productos en el carrito">
            <ul className={styles.itemList}>
              {items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <div className={styles.itemImageWrapper}>
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className={styles.itemImage}
                        sizes="80px"
                      />
                    ) : (
                      <div className={styles.itemImageFallback} />
                    )}
                  </div>
                  <div className={styles.itemInfo}>
                    <p className={styles.itemName}>{item.name}</p>
                    <p className={styles.itemPrice}>{formatARS(item.price_ars)}</p>
                    <div className={styles.itemActions}>
                      <div className={styles.qtyControl}>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label="Disminuir cantidad"
                        >
                          −
                        </button>
                        <span className={styles.qty}>{item.quantity}</span>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label="Aumentar cantidad"
                        >
                          +
                        </button>
                      </div>
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeItem(item.id)}
                        aria-label={`Eliminar ${item.name}`}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <p className={styles.itemSubtotal}>
                    {formatARS(item.price_ars * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
            <button className={styles.clearBtn} onClick={clearCart}>
              Vaciar carrito
            </button>
          </section>

          {/* Panel de resumen + formulario */}
          <aside className={styles.summary}>
            <h2 className={styles.summaryTitle}>Resumen del pedido</h2>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>{formatARS(totalARS)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Envío</span>
              <span className={styles.shippingNote}>A coordinar</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>{formatARS(totalARS)}</span>
            </div>

            <form onSubmit={handleCheckout} className={styles.form} noValidate>
              <h3 className={styles.formTitle}>Tus datos</h3>
              <div className={styles.fieldGroup}>
                <label htmlFor="name" className={styles.label}>Nombre completo *</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className={styles.input}
                  value={buyer.name}
                  onChange={handleBuyerChange}
                  required
                  autoComplete="name"
                  placeholder="Ej: María García"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="email" className={styles.label}>Email *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={styles.input}
                  value={buyer.email}
                  onChange={handleBuyerChange}
                  required
                  autoComplete="email"
                  placeholder="tu@email.com"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="phone" className={styles.label}>Teléfono</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className={styles.input}
                  value={buyer.phone}
                  onChange={handleBuyerChange}
                  autoComplete="tel"
                  placeholder="+54 9 11 1234-5678"
                />
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <button
                type="submit"
                className={styles.checkoutBtn}
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Pagar con MercadoPago'}
              </button>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
