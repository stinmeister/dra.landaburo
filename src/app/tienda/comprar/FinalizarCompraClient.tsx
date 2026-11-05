'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart, type CartItem } from '@/contexts/CartContext';
import { trackBeginCheckout } from '@/lib/tracking';
import { buildStoreWhatsappUrl } from '@/lib/storeWhatsapp';
import styles from './comprar.module.css';

export interface DirectCheckoutProduct {
  id: string;
  slug: string;
  name: string;
  price_ars: number;
  image_url: string | null;
  stock_quantity: number;
}

export interface CheckoutStoreConfig {
  isConfigured: boolean;
  checkoutEnabled: boolean;
  shippingEnabled: boolean;
  shippingCostArs: number;
  pickupAddress: string;
  pickupHours: string;
}

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

const BUYER_STORAGE_KEY = 'landaburo_buyer_v1';

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

interface Props {
  mode: 'direct' | 'cart';
  directProduct: DirectCheckoutProduct | null;
  directNotFound?: boolean;
  initialQuantity: number;
  storeConfig: CheckoutStoreConfig;
}

export default function FinalizarCompraClient({
  mode,
  directProduct,
  directNotFound = false,
  initialQuantity,
  storeConfig,
}: Props) {
  const { items: cartItems, hydrated, updateQuantity, removeItem } = useCart();
  const [directQty, setDirectQty] = useState(() => {
    const maxStock = Math.max(1, directProduct?.stock_quantity ?? 1);
    return Math.min(Math.max(1, initialQuantity), maxStock);
  });

  const [buyer, setBuyer] = useState<BuyerForm>({ name: '', email: '', phone: '' });
  const [buyerLoaded, setBuyerLoaded] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'retiro' | 'envio'>('retiro');
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>({
    address: '',
    city: '',
    postalCode: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recordar datos previos de la compradora en este navegador
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BUYER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BuyerForm>;
        setBuyer({
          name: typeof parsed.name === 'string' ? parsed.name : '',
          email: typeof parsed.email === 'string' ? parsed.email : '',
          phone: typeof parsed.phone === 'string' ? parsed.phone : '',
        });
      }
    } catch {
      // localStorage bloqueado o inválido
    }
    setBuyerLoaded(true);
  }, []);

  useEffect(() => {
    if (!buyerLoaded) return;
    try {
      localStorage.setItem(BUYER_STORAGE_KEY, JSON.stringify(buyer));
    } catch {
      // Falla silenciosa
    }
  }, [buyer, buyerLoaded]);

  useEffect(() => {
    if (!storeConfig.shippingEnabled && deliveryMethod === 'envio') {
      setDeliveryMethod('retiro');
    }
  }, [storeConfig.shippingEnabled, deliveryMethod]);

  if (mode === 'direct' && (directNotFound || !directProduct || directProduct.stock_quantity <= 0)) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.emptyCard}>
            <h1 className={styles.emptyTitle}>
              {directProduct && directProduct.stock_quantity <= 0
                ? 'Este producto se encuentra sin stock'
                : 'No encontramos el producto seleccionado'}
            </h1>
            <p className={styles.emptyText}>
              Volvé a la tienda para elegir otro producto disponible.
            </p>
            <Link href="/tienda" className={styles.emptyLink}>
              Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const checkoutItems: CartItem[] =
    mode === 'direct' && directProduct
      ? [
          {
            id: directProduct.id,
            slug: directProduct.slug,
            name: directProduct.name,
            price_ars: directProduct.price_ars,
            image_url: directProduct.image_url,
            quantity: directQty,
          },
        ]
      : cartItems;

  if (mode === 'cart' && hydrated && checkoutItems.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.emptyCard}>
            <h1 className={styles.emptyTitle}>Tu carrito está vacío</h1>
            <p className={styles.emptyText}>
              Agregá productos desde la tienda para finalizar tu compra.
            </p>
            <Link href="/tienda" className={styles.emptyLink}>
              Ver productos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const subtotalARS = checkoutItems.reduce(
    (sum, item) => sum + item.price_ars * item.quantity,
    0
  );
  const totalQty = checkoutItems.reduce((sum, item) => sum + item.quantity, 0);
  const shippingARS =
    deliveryMethod === 'envio' && storeConfig.shippingEnabled
      ? storeConfig.shippingCostArs
      : 0;
  const totalARS = subtotalARS + shippingARS;

  const isCheckoutAllowed = Boolean(
    storeConfig.isConfigured && storeConfig.checkoutEnabled
  );

  const deliveryWaSummary =
    deliveryMethod === 'envio'
      ? `Envío a domicilio (${deliveryForm.address || 'A coordinar'}, ${deliveryForm.city || ''})`
      : `Retiro en consultorio${storeConfig.pickupAddress ? ` (${storeConfig.pickupAddress})` : ''}`;

  const waCheckoutUrl = buildStoreWhatsappUrl(
    `Hola! Quisiera comprar los siguientes productos de la tienda:\n${checkoutItems
      .map((i) => `• ${i.quantity}x ${i.name}`)
      .join('\n')}\nEntrega: ${deliveryWaSummary}\nTotal: ${formatARS(totalARS)}`
  );

  const handleBuyerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBuyer((prev) => ({ ...prev, [name]: value }));
  };

  const handleDeliveryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDeliveryForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutItems.length === 0) return;
    setError(null);

    if (!buyer.name.trim() || !buyer.email.trim()) {
      setError('Por favor completá tu nombre y email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim())) {
      setError('El email ingresado no es válido.');
      return;
    }

    if (deliveryMethod === 'envio') {
      if (
        !deliveryForm.address.trim() ||
        !deliveryForm.city.trim() ||
        !deliveryForm.postalCode.trim()
      ) {
        setError(
          'Por favor completá los datos obligatorios de envío: Dirección, Localidad y Código Postal.'
        );
        return;
      }
    }

    setLoading(true);
    trackBeginCheckout(checkoutItems, totalARS);

    try {
      const res = await fetch('/api/checkout/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems,
          buyer: {
            name: buyer.name.trim(),
            email: buyer.email.trim(),
            phone: buyer.phone.trim(),
          },
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
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos iniciar el cobro online. Escribinos por WhatsApp para coordinar tu compra.'
      );
      setLoading(false);
    }
  };

  const backHref =
    mode === 'direct' && directProduct
      ? `/tienda/${directProduct.slug}`
      : '/tienda/carrito';
  const backLabel =
    mode === 'direct' ? '← Volver al producto' : '← Volver al carrito';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <Link href={backHref} className={styles.backLink}>
            {backLabel}
          </Link>
          <h1 className={styles.title}>Finalizá tu compra</h1>
        </div>

        <form onSubmit={handleSubmit} className={styles.flowForm} noValidate>
          {/* 1. Producto(s) y cantidad */}
          <section className={styles.sectionCard} aria-label="Productos de tu compra">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                {checkoutItems.length === 1 ? 'Tu producto' : 'Tus productos'}
              </h2>
              {mode === 'cart' && (
                <Link href="/tienda/carrito" className={styles.sectionActionLink}>
                  Editar carrito
                </Link>
              )}
            </div>

            <ul className={styles.itemList}>
              {checkoutItems.map((item) => {
                const maxDirectStock =
                  mode === 'direct' && directProduct
                    ? Math.max(1, directProduct.stock_quantity)
                    : undefined;
                return (
                  <li key={item.id} className={styles.itemRow}>
                    <div className={styles.itemThumb}>
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className={styles.itemImage}
                          sizes="72px"
                        />
                      ) : (
                        <div className={styles.itemImageFallback} />
                      )}
                    </div>

                    <div className={styles.itemBody}>
                      <p className={styles.itemName}>{item.name}</p>
                      <p className={styles.itemUnitPrice}>
                        {formatARS(item.price_ars)} c/u
                      </p>
                      <div className={styles.itemControls}>
                        {maxDirectStock === 1 ? (
                          <span className={styles.lastUnitNote}>
                            1 unidad · Última unidad disponible
                          </span>
                        ) : (
                          <div className={styles.qtyStepper}>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              onClick={() =>
                                mode === 'direct'
                                  ? setDirectQty((q) => Math.max(1, q - 1))
                                  : updateQuantity(item.id, item.quantity - 1)
                              }
                              disabled={item.quantity <= 1}
                              aria-label="Disminuir cantidad"
                            >
                              −
                            </button>
                            <span className={styles.qtyVal}>{item.quantity}</span>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              onClick={() =>
                                mode === 'direct'
                                  ? setDirectQty((q) =>
                                      maxDirectStock ? Math.min(maxDirectStock, q + 1) : q + 1
                                    )
                                  : updateQuantity(item.id, item.quantity + 1)
                              }
                              disabled={
                                maxDirectStock !== undefined &&
                                item.quantity >= maxDirectStock
                              }
                              aria-label="Aumentar cantidad"
                            >
                              +
                            </button>
                          </div>
                        )}
                        {mode === 'cart' && (
                          <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => removeItem(item.id)}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>

                    <p className={styles.itemSubtotal}>
                      {formatARS(item.price_ars * item.quantity)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 2. Forma de entrega (pestañas Retiro / Envío) */}
          <section className={styles.sectionCard} aria-label="Forma de entrega">
            <h2 className={styles.sectionTitle}>Forma de entrega</h2>
            <div className={styles.deliveryTabs} role="tablist" aria-label="Método de entrega">
              <button
                type="button"
                role="tab"
                aria-selected={deliveryMethod === 'retiro'}
                className={`${styles.deliveryTab} ${
                  deliveryMethod === 'retiro' ? styles.deliveryTabActive : ''
                }`}
                onClick={() => setDeliveryMethod('retiro')}
              >
                <span>Retiro</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={deliveryMethod === 'envio'}
                aria-disabled={!storeConfig.shippingEnabled}
                disabled={!storeConfig.shippingEnabled}
                className={`${styles.deliveryTab} ${
                  !storeConfig.shippingEnabled
                    ? styles.deliveryTabDisabled
                    : deliveryMethod === 'envio'
                    ? styles.deliveryTabActive
                    : ''
                }`}
                onClick={() => {
                  if (storeConfig.shippingEnabled) setDeliveryMethod('envio');
                }}
              >
                <span>Envío</span>
                {!storeConfig.shippingEnabled && (
                  <span className={styles.comingSoonBadge}>Próximamente</span>
                )}
              </button>
            </div>

            {deliveryMethod === 'retiro' && (
              <div className={styles.pickupBox}>
                <p className={styles.pickupTitle}>Retiro en consultorio (Sin costo)</p>
                <p className={styles.pickupLine}>
                  <strong>Dirección:</strong> {storeConfig.pickupAddress || 'A coordinar'}
                </p>
                <p className={styles.pickupLine}>
                  <strong>Cuándo retirar:</strong> {storeConfig.pickupHours || 'A coordinar'}
                </p>
              </div>
            )}

            {deliveryMethod === 'envio' && storeConfig.shippingEnabled && (
              <div className={styles.shippingFields}>
                <div className={`${styles.fieldGroup} ${styles.shippingFieldFull}`}>
                  <label htmlFor="checkout-address" className={styles.label}>
                    Calle y número *
                  </label>
                  <input
                    id="checkout-address"
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
                  <label htmlFor="checkout-city" className={styles.label}>
                    Ciudad / Localidad *
                  </label>
                  <input
                    id="checkout-city"
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
                  <label htmlFor="checkout-postalCode" className={styles.label}>
                    Código Postal *
                  </label>
                  <input
                    id="checkout-postalCode"
                    name="postalCode"
                    type="text"
                    className={styles.input}
                    value={deliveryForm.postalCode}
                    onChange={handleDeliveryChange}
                    placeholder="Ej: 2820"
                    required
                  />
                </div>
                <div className={`${styles.fieldGroup} ${styles.shippingFieldFull}`}>
                  <label htmlFor="checkout-notes" className={styles.label}>
                    Piso / Depto / Referencias (opcional)
                  </label>
                  <input
                    id="checkout-notes"
                    name="notes"
                    type="text"
                    className={styles.input}
                    value={deliveryForm.notes}
                    onChange={handleDeliveryChange}
                    placeholder="Ej: Piso 3 Depto B"
                  />
                </div>
              </div>
            )}
          </section>

          {/* 3. Datos de la compradora */}
          <section className={styles.sectionCard} aria-label="Datos de la compradora">
            <h2 className={styles.sectionTitle}>Tus datos</h2>
            <div className={styles.fieldsStack}>
              <div className={styles.fieldGroup}>
                <label htmlFor="buyer-name" className={styles.label}>
                  Nombre completo *
                </label>
                <input
                  id="buyer-name"
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
                <label htmlFor="buyer-email" className={styles.label}>
                  Email *
                </label>
                <input
                  id="buyer-email"
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
                <label htmlFor="buyer-phone" className={styles.label}>
                  Teléfono / WhatsApp
                </label>
                <input
                  id="buyer-phone"
                  name="phone"
                  type="tel"
                  className={styles.input}
                  value={buyer.phone}
                  onChange={handleBuyerChange}
                  autoComplete="tel"
                  placeholder="Ej: 3446 412345"
                />
              </div>
            </div>
          </section>

          {/* 4. Resumen con el total */}
          <section className={styles.sectionCard} aria-label="Resumen de compra">
            <h2 className={styles.sectionTitle}>Resumen</h2>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <span>
                  {totalQty === 1 ? 'Producto (1)' : `Productos (${totalQty})`}
                </span>
                <span>{formatARS(subtotalARS)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Entrega</span>
                <span className={styles.summaryMuted}>
                  {deliveryMethod === 'retiro'
                    ? 'Sin costo (Retiro en consultorio)'
                    : shippingARS > 0
                    ? formatARS(shippingARS)
                    : 'A coordinar'}
                </span>
              </div>
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <span>{formatARS(totalARS)}</span>
              </div>
            </div>
          </section>

          {/* 5. Botón Pagar + leyenda */}
          <div className={styles.payBlock}>
            {error && (
              <div className={styles.errorMsg}>
                <p style={{ margin: 0 }}>{error}</p>
                {/whatsapp/i.test(error) && (
                  <a
                    href={waCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.whatsappBtn}
                  >
                    Escribir por WhatsApp
                  </a>
                )}
              </div>
            )}

            {!isCheckoutAllowed ? (
              <div style={{ textAlign: 'center' }}>
                <button type="button" className={styles.payBtn} disabled>
                  Los pagos online están temporalmente desactivados
                </button>
                <p className={styles.payHelper} style={{ marginTop: '0.65rem' }}>
                  Escribinos por WhatsApp para coordinar tu compra:
                </p>
                <a
                  href={waCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.whatsappBtn}
                >
                  Escribir por WhatsApp
                </a>
              </div>
            ) : (
              <>
                <button
                  type="submit"
                  className={styles.payBtn}
                  disabled={loading || checkoutItems.length === 0}
                >
                  {loading ? 'Procesando...' : 'Pagar'}
                </button>
                <p className={styles.payHelper}>
                  Tarjeta de crédito, débito o Mercado Pago. No necesitás cuenta de Mercado Pago.
                </p>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
