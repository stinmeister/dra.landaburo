'use client';
// Componente cliente del carrito — muestra los productos agregados con cantidad editable,
// el total y el botón "Continuar" hacia la pantalla unificada "Finalizá tu compra" (/tienda/comprar).
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import styles from './carrito.module.css';

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

export default function CarritoClient() {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalARS } = useCart();

  if (items.length === 0) {
    return (
      <main className={styles.emptyWrapper}>
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>Tu carrito está vacío</p>
          <p className={styles.emptyText}>
            Explorá la tienda y agregá los productos que necesitás.
          </p>
          <Link href="/tienda" className={styles.emptyBtn}>
            Ver productos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
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
          {/* Lista de items con cantidad editable */}
          <section className={styles.itemsSection} aria-label="Productos en el carrito">
            <ul className={styles.itemList}>
              {items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <Link href={`/tienda/${item.slug}`} className={styles.itemImageWrapper}>
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
                  </Link>
                  <div className={styles.itemInfo}>
                    <Link href={`/tienda/${item.slug}`} className={styles.itemNameLink}>
                      <p className={styles.itemName}>{item.name}</p>
                    </Link>
                    <p className={styles.itemPrice}>{formatARS(item.price_ars)} c/u</p>
                    <div className={styles.itemActions}>
                      <div className={styles.qtyControl}>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Disminuir cantidad"
                        >
                          −
                        </button>
                        <span className={styles.qty}>{item.quantity}</span>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={
                            typeof item.max_stock === 'number' &&
                            item.quantity >= item.max_stock
                          }
                          aria-label="Aumentar cantidad"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeItem(item.id)}
                        aria-label={`Eliminar ${item.name}`}
                      >
                        Eliminar
                      </button>
                    </div>
                    {typeof item.max_stock === 'number' && item.quantity >= item.max_stock && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.76rem', color: 'var(--color-gris)' }}>
                        Máximo disponible en stock ({item.max_stock} {item.max_stock === 1 ? 'unidad' : 'unidades'})
                      </p>
                    )}
                  </div>
                  <p className={styles.itemSubtotal}>
                    {formatARS(item.price_ars * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.clearBtn} onClick={clearCart}>
              Vaciar carrito
            </button>
          </section>

          {/* Resumen + botón Continuar hacia /tienda/comprar */}
          <aside className={styles.summary}>
            <h2 className={styles.summaryTitle}>Resumen</h2>
            <div className={styles.summaryRow}>
              <span>
                {totalItems === 1 ? 'Producto (1)' : `Productos (${totalItems})`}
              </span>
              <span>{formatARS(totalARS)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Entrega</span>
              <span className={styles.shippingNote}>Sin costo (Retiro en consultorio)</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>{formatARS(totalARS)}</span>
            </div>

            <Link href="/tienda/comprar" className={styles.continueBtn}>
              Continuar
            </Link>
            <p className={styles.paymentNote}>
              Tarjeta de crédito, débito o Mercado Pago. No necesitás cuenta de Mercado Pago.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
