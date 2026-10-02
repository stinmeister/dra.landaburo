'use client';
// Página del carrito — Client Component porque depende del CartContext (localStorage).
// Incluye selector de método de entrega (Retiro / Envío) y checkout condicionado a store_config.
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { trackBeginCheckout } from '@/lib/tracking';
import styles from './carrito.module.css';

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

interface BuyerForm {
  name: string;
  email: string;
  phone: string;
}

interface DeliveryForm {
  address: string;
  city: string;
  postalCode: string;
  notes: string;
}

interface StoreStatus {
  isConfigured: boolean;
  checkoutEnabled: boolean;
  shippingEnabled: boolean;
  shippingCostArs: number;
  pickupAddress: string;
  pickupHours: string;
}

export default function CarritoPage() {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalARS } = useCart();
  const [buyer, setBuyer] = useState<BuyerForm>({ name: '', email: '', phone: '' });
  const [deliveryMethod, setDeliveryMethod] = useState<'retiro' | 'envio'>('retiro');
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>({
    address: '',
    city: '',
    postalCode: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StoreStatus | null>(null);

  useEffect(() => {
    fetch('/api/checkout/mercadopago/status')
      .then((res) => res.json())
      .then((data: StoreStatus) => {
        setStatus(data);
        // Si los envíos están deshabilitados, forzar retiro
        if (!data.shippingEnabled) {
          setDeliveryMethod('retiro');
        }
      })
      .catch(() => {
        setStatus({
          isConfigured: false,
          checkoutEnabled: false,
          shippingEnabled: false,
          shippingCostArs: 0,
          pickupAddress: 'Leandro N. Alem 45, Gualeguaychú, Entre Ríos',
          pickupHours: 'Lunes a Viernes de 9:00 a 17:00 hs',
        });
      });
  }, []);

  const handleBuyerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBuyer((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDeliveryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeliveryForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isCheckoutAllowed = Boolean(status?.isConfigured && status?.checkoutEnabled);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setError(null);

    // Validaciones en cliente
    if (!buyer.name.trim() || !buyer.email.trim()) {
      setError('Por favor completá tu nombre y email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim())) {
      setError('El email ingresado no es válido.');
      return;
    }

    if (deliveryMethod === 'envio') {
      if (!deliveryForm.address.trim() || !deliveryForm.city.trim() || !deliveryForm.postalCode.trim()) {
        setError('Por favor completá los datos obligatorios de envío: Dirección, Localidad y Código Postal.');
        return;
      }
    }

    setLoading(true);

    // Medición de inicio de checkout
    trackBeginCheckout(items, totalARS);

    try {
      const res = await fetch('/api/checkout/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          buyer,
          delivery: {
            method: deliveryMethod,
            address: deliveryForm.address.trim(),
            city: deliveryForm.city.trim(),
            postalCode: deliveryForm.postalCode.trim(),
            notes: deliveryForm.notes.trim(),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      const { init_point } = await res.json();
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

  // Texto para WhatsApp en caso de checkout deshabilitado
  const deliveryWaSummary =
    deliveryMethod === 'envio'
      ? `Envío a domicilio (${deliveryForm.address || 'A coordinar'}, ${deliveryForm.city || ''})`
      : `Retiro en consultorio (${status?.pickupAddress || 'Leandro N. Alem 45'})`;

  const waCheckoutUrl = `https://wa.me/5491169684062?text=${encodeURIComponent(
    `Hola! Quisiera comprar los siguientes productos de la tienda:\n${items
      .map((i) => `• ${i.quantity}x ${i.name}`)
      .join('\n')}\nEntrega: ${deliveryWaSummary}\nTotal: ${formatARS(totalARS)}`
  )}`;

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
              <span>Entrega</span>
              <span className={styles.shippingNote}>
                {deliveryMethod === 'retiro' ? 'Gratis (Retiro)' : 'A coordinar'}
              </span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>{formatARS(totalARS)}</span>
            </div>

            <form onSubmit={handleCheckout} className={styles.form} noValidate>
              <h3 className={styles.formTitle}>Tus datos</h3>
              <div className={styles.fieldGroup}>
                <label htmlFor="name" className={styles.label}>
                  Nombre completo *
                </label>
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
                <label htmlFor="email" className={styles.label}>
                  Email *
                </label>
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
                <label htmlFor="phone" className={styles.label}>
                  Teléfono / WhatsApp
                </label>
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

              {/* Selector de Método de Entrega */}
              <div className={styles.deliverySection}>
                <h3 className={styles.formTitle}>Método de entrega</h3>
                <div className={styles.deliveryOptions}>
                  {/* Opción Retiro en consultorio */}
                  <label
                    className={`${styles.deliveryCard} ${
                      deliveryMethod === 'retiro' ? styles.deliveryCardSelected : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value="retiro"
                      checked={deliveryMethod === 'retiro'}
                      onChange={() => setDeliveryMethod('retiro')}
                      className={styles.deliveryRadio}
                    />
                    <div className={styles.deliveryCardContent}>
                      <span className={styles.deliveryCardTitle}>Retiro en consultorio (Gratis)</span>
                      <span className={styles.deliveryCardDesc}>
                        Retirás personalmente en nuestro consultorio
                      </span>
                    </div>
                  </label>

                  {/* Opción Envío a domicilio — solo si shipping_enabled es true */}
                  {status?.shippingEnabled ? (
                    <label
                      className={`${styles.deliveryCard} ${
                        deliveryMethod === 'envio' ? styles.deliveryCardSelected : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value="envio"
                        checked={deliveryMethod === 'envio'}
                        onChange={() => setDeliveryMethod('envio')}
                        className={styles.deliveryRadio}
                      />
                      <div className={styles.deliveryCardContent}>
                        <span className={styles.deliveryCardTitle}>Envío a domicilio</span>
                        <span className={styles.deliveryCardDesc}>
                          Entrega en tu dirección postal (costo a coordinar)
                        </span>
                      </div>
                    </label>
                  ) : null}
                </div>

                {/* Detalles de retiro leídos de store_config */}
                {deliveryMethod === 'retiro' && (
                  <div className={styles.pickupDetailsBox}>
                    <p>
                      <strong>📍 Dirección:</strong>{' '}
                      {status?.pickupAddress || 'Leandro N. Alem 45, Gualeguaychú, Entre Ríos'}
                    </p>
                    <p>
                      <strong>🕒 Horario de atención:</strong>{' '}
                      {status?.pickupHours || 'Lunes a Viernes de 9:00 a 17:00 hs'}
                    </p>
                  </div>
                )}

                {/* Campos de domicilio si se seleccionó envío */}
                {deliveryMethod === 'envio' && status?.shippingEnabled && (
                  <div className={styles.shippingFields}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="address" className={styles.label}>
                        Calle y número *
                      </label>
                      <input
                        id="address"
                        name="address"
                        type="text"
                        className={styles.input}
                        value={deliveryForm.address}
                        onChange={handleDeliveryChange}
                        placeholder="Ej: San Martín 123"
                        required
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="city" className={styles.label}>
                        Ciudad / Localidad *
                      </label>
                      <input
                        id="city"
                        name="city"
                        type="text"
                        className={styles.input}
                        value={deliveryForm.city}
                        onChange={handleDeliveryChange}
                        placeholder="Ej: Gualeguaychú"
                        required
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="postalCode" className={styles.label}>
                        Código Postal *
                      </label>
                      <input
                        id="postalCode"
                        name="postalCode"
                        type="text"
                        className={styles.input}
                        value={deliveryForm.postalCode}
                        onChange={handleDeliveryChange}
                        placeholder="Ej: 2820"
                        required
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="notes" className={styles.label}>
                        Piso / Depto / Referencias (opcional)
                      </label>
                      <input
                        id="notes"
                        name="notes"
                        type="text"
                        className={styles.input}
                        value={deliveryForm.notes}
                        onChange={handleDeliveryChange}
                        placeholder="Ej: Piso 3 Depto B / Entre calles..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              {/* Botón de pago o fallback WhatsApp */}
              {!isCheckoutAllowed ? (
                <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    className={styles.checkoutBtn}
                    disabled
                    style={{
                      opacity: 0.7,
                      cursor: 'not-allowed',
                      marginBottom: '0.75rem',
                      backgroundColor: '#9ca3af',
                    }}
                  >
                    Los pagos online están temporalmente desactivados
                  </button>
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-gris)',
                      marginBottom: '0.75rem',
                      lineHeight: 1.4,
                    }}
                  >
                    Escribinos por WhatsApp para coordinar tu compra:
                  </p>
                  <a
                    href={waCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.checkoutBtn}
                    style={{
                      display: 'inline-block',
                      textDecoration: 'none',
                      backgroundColor: '#25D366',
                      borderColor: '#25D366',
                      color: '#ffffff',
                      fontWeight: 600,
                      padding: '0.85rem 1.25rem',
                    }}
                  >
                    Escribinos por WhatsApp
                  </a>
                </div>
              ) : (
                <button
                  type="submit"
                  className={styles.checkoutBtn}
                  disabled={loading || status === null}
                >
                  {loading ? 'Procesando...' : 'Pagar con MercadoPago'}
                </button>
              )}
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
