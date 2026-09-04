'use client';

import { useState } from 'react';
import { Trash2, Plus, Minus, Gift, Sparkles, CheckCircle2 } from 'lucide-react';
import type { GiftCardCatalogItem } from './page';
import { trackConfigureGiftCard, trackBeginCheckout } from '@/lib/tracking';
import styles from './gift-cards.module.css';

export interface SelectedCartItem {
  id: string; // generated client-side unique id for key
  item_type: 'treatment' | 'product' | 'custom_amount';
  treatment_id?: string | null;
  product_id?: string | null;
  custom_amount_ars?: number | null;
  title: string;
  unit_price: number;
  quantity: number;
}

interface FormState {
  senderName: string;
  senderEmail: string;
  recipientName: string;
  dedication: string;
  deliveryMethod: 'digital' | 'fisica';
}

export default function GiftCardForm({ catalog }: { catalog: GiftCardCatalogItem[] }) {
  const [selectedItems, setSelectedItems] = useState<SelectedCartItem[]>([]);
  const [customAmountInput, setCustomAmountInput] = useState<string>('50000');
  const [form, setForm] = useState<FormState>({
    senderName: '',
    senderEmail: '',
    recipientName: '',
    dedication: '',
    deliveryMethod: 'digital',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'treatment' | 'product' | 'custom'>('all');

  const formatARS = (n: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(n);

  const filteredCatalog = catalog.filter(
    (item) => filter === 'all' || item.type === filter
  );

  const totalARS = selectedItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  // 1. Agregar item del catálogo
  const handleAddItem = (item: GiftCardCatalogItem) => {
    setSelectedItems((prev) => {
      const existing = prev.find(
        (i) =>
          (item.type === 'treatment' && i.treatment_id === item.id) ||
          (item.type === 'product' && i.product_id === item.id)
      );
      if (existing) {
        return prev.map((i) =>
          i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: `item_${Date.now()}_${Math.random()}`,
          item_type: item.type,
          treatment_id: item.type === 'treatment' ? item.id : null,
          product_id: item.type === 'product' ? item.id : null,
          custom_amount_ars: null,
          title: item.name,
          unit_price: item.price_ars,
          quantity: 1,
        },
      ];
    });
    setError('');
  };

  // 2. Agregar monto libre
  const handleAddCustomAmount = () => {
    const val = parseFloat(customAmountInput.replace(/[^0-9]/g, ''));
    if (isNaN(val) || val < 10000) {
      setError('El monto mínimo para saldo libre es de $ 10.000 ARS.');
      return;
    }
    setSelectedItems((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        item_type: 'custom_amount',
        treatment_id: null,
        product_id: null,
        custom_amount_ars: val,
        title: `Saldo a elección en consultorio (${formatARS(val)})`,
        unit_price: val,
        quantity: 1,
      },
    ]);
    setError('');
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as SelectedCartItem[]
    );
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      setError('Agregá al menos un tratamiento, producto o saldo libre a la Gift Card.');
      return;
    }
    if (!form.senderName.trim() || !form.senderEmail.trim()) {
      setError('Completá tu nombre y email.');
      return;
    }
    setError('');
    setLoading(true);

    // Track checkout
    trackConfigureGiftCard();
    trackBeginCheckout(
      selectedItems.map((i) => ({
        id: i.id,
        name: i.title,
        price_ars: i.unit_price,
        quantity: i.quantity,
      })),
      totalARS
    );

    try {
      const res = await fetch('/api/gift-cards/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            item_type: item.item_type,
            treatment_id: item.treatment_id,
            product_id: item.product_id,
            custom_amount_ars: item.custom_amount_ars,
            unit_price_ars: item.unit_price,
            quantity: item.quantity,
            title: item.title,
          })),
          sender_name: form.senderName.trim(),
          sender_email: form.senderEmail.trim().toLowerCase(),
          recipient_name: form.recipientName.trim() || null,
          dedication: form.dedication.trim() || null,
          delivery_method: form.deliveryMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al procesar el pago. Intentá de nuevo.');
        return;
      }
      window.location.href = data.init_point;
    } catch {
      setError('Error de conexión con el servidor. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Experiencia Personalizada</span>
          <h1 className={styles.heroTitle}>Gift Cards Combinables</h1>
          <p className={styles.heroSubtitle}>
            Diseñá una experiencia a medida: combiná tratamientos faciales o corporales,
            productos de dermocosmética y saldo libre en pesos en una única tarjeta de regalo.
          </p>
        </div>
      </section>

      <section className={styles.builderSection}>
        <div className={styles.builderGrid}>
          {/* Columna Izquierda: Configurador */}
          <div className={styles.formCol}>
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <h2 className={styles.formTitle}>1. Armá el contenido del regalo</h2>

              {/* Pestañas de filtro */}
              <div className={styles.filterTabs}>
                {(['all', 'treatment', 'product', 'custom'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all'
                      ? 'Todo'
                      : f === 'treatment'
                      ? 'Tratamientos'
                      : f === 'product'
                      ? 'Skincare'
                      : 'Monto Libre'}
                  </button>
                ))}
              </div>

              {/* Selector de Catálogo */}
              {filter !== 'custom' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Elegí opciones para sumar al regalo:</label>
                  <div className={styles.catalogGrid}>
                    {filteredCatalog.map((item) => (
                      <button
                        key={`${item.type}_${item.id}`}
                        type="button"
                        className={styles.catalogBtn}
                        onClick={() => handleAddItem(item)}
                      >
                        <span className={styles.catalogBtnType}>
                          {item.type === 'treatment' ? '💆 Tratamiento' : '🧴 Skincare'}
                        </span>
                        <span className={styles.catalogBtnName}>{item.name}</span>
                        <span className={styles.catalogBtnPrice}>{formatARS(item.price_ars)}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-champagne-dark)', marginTop: '0.2rem' }}>
                          + Sumar a la tarjeta
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Monto Libre */}
              {(filter === 'all' || filter === 'custom') && (
                <div style={{
                  padding: '1rem',
                  background: 'var(--color-bg-alt)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  marginBottom: '1.5rem'
                }}>
                  <label className={styles.fieldLabel} style={{ marginBottom: '0.5rem', display: 'block' }}>
                    O sumá saldo libre en pesos ($ ARS):
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      type="number"
                      min="10000"
                      step="5000"
                      className={styles.input}
                      value={customAmountInput}
                      onChange={(e) => setCustomAmountInput(e.target.value)}
                      placeholder="Ej. 50000"
                      style={{ maxWidth: '200px' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomAmount}
                      className={styles.btnSecondary}
                      style={{ padding: '0.6rem 1.25rem' }}
                    >
                      Sumar Saldo Libre
                    </button>
                  </div>
                </div>
              )}

              {/* Carrito de la Gift Card */}
              <div style={{
                background: '#fafafa',
                border: '1.5px solid var(--color-champagne)',
                borderRadius: '6px',
                padding: '1.25rem',
                marginBottom: '2rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontFamily: 'var(--font-sans)', fontWeight: 700, color: 'var(--color-negro)' }}>
                    Contenido de la Gift Card ({selectedItems.length} ítem{selectedItems.length !== 1 ? 's' : ''})
                  </h3>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-negro)' }}>
                    Total: {formatARS(totalARS)}
                  </span>
                </div>

                {selectedItems.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gris)', fontStyle: 'italic' }}>
                    Aún no seleccionaste ningún ítem. Hacé clic en los tratamientos o productos arriba para agregarlos.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {selectedItems.map((item) => (
                      <li
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          background: '#fff',
                          border: '1px solid #e5e5e5',
                          borderRadius: '4px',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-negro)', display: 'block' }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-gris)' }}>
                            {formatARS(item.unit_price)} c/u
                          </span>
                        </div>

                        {item.item_type !== 'custom_amount' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, -1)}
                              style={{ width: '24px', height: '24px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', borderRadius: '3px' }}
                            >
                              -
                            </button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '16px', textAlign: 'center' }}>
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, 1)}
                              style={{ width: '24px', height: '24px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', borderRadius: '3px' }}
                            >
                              +
                            </button>
                          </div>
                        )}

                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-negro)', minWidth: '85px', textAlign: 'right' }}>
                          {formatARS(item.unit_price * item.quantity)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label="Eliminar ítem"
                          style={{ background: 'transparent', border: 'none', color: '#c0392b', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <h2 className={styles.formTitle}>2. Datos del Agasajo y Remitente</h2>

              {/* Sender */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="senderName">Tu nombre completo *</label>
                <input
                  id="senderName"
                  type="text"
                  className={styles.input}
                  placeholder="¿De parte de quién?"
                  value={form.senderName}
                  onChange={(e) => setForm((f) => ({ ...f, senderName: e.target.value }))}
                  required
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="senderEmail">Tu email *</label>
                <input
                  id="senderEmail"
                  type="email"
                  className={styles.input}
                  placeholder="Para enviarte la confirmación y el voucher"
                  value={form.senderEmail}
                  onChange={(e) => setForm((f) => ({ ...f, senderEmail: e.target.value }))}
                  required
                />
              </div>

              {/* Recipient */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="recipientName">
                  Nombre del agasajado/a
                </label>
                <input
                  id="recipientName"
                  type="text"
                  className={styles.input}
                  placeholder="¿A quién le dedicás este regalo?"
                  value={form.recipientName}
                  onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                />
              </div>

              {/* Dedication */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="dedication">Dedicatoria personal</label>
                <textarea
                  id="dedication"
                  className={styles.textarea}
                  placeholder="Escribí un mensaje cálido y especial..."
                  rows={3}
                  maxLength={200}
                  value={form.dedication}
                  onChange={(e) => setForm((f) => ({ ...f, dedication: e.target.value }))}
                />
                <span className={styles.charCount}>{form.dedication.length}/200</span>
              </div>

              {/* Delivery method */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Modalidad de entrega</label>
                <div className={styles.deliveryGrid}>
                  {(['digital', 'fisica'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.deliveryBtn} ${
                        form.deliveryMethod === m ? styles.deliveryBtnSelected : ''
                      }`}
                      onClick={() => setForm((f) => ({ ...f, deliveryMethod: m }))}
                    >
                      <span>{m === 'digital' ? '📧 Digital' : '🎁 Tarjeta física'}</span>
                      <span className={styles.deliveryDetail}>
                        {m === 'digital'
                          ? 'Por email, al instante con voucher descargable'
                          : 'Presentación de lujo para retirar en consultorio'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading || selectedItems.length === 0}
              >
                {loading
                  ? 'Procesando...'
                  : `Comprar Gift Card — ${formatARS(totalARS)} →`}
              </button>
              <p className={styles.footNote}>
                Pago seguro vía MercadoPago. Vigencia de 90 días corridos a partir de la confirmación.
              </p>
            </form>
          </div>

          {/* Columna Derecha: Vista Previa */}
          <div className={styles.previewCol}>
            <p className={styles.previewLabel}>Vista previa de la Gift Card</p>
            <div className={styles.cardPreview}>
              <div className={styles.cardTop}>
                <span className={styles.cardBrand}>Dra. Landaburo</span>
                <span className={styles.cardSubBrand}>Medicina Estética &amp; Dermatología</span>
              </div>

              <div style={{ margin: '1rem 0' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-champagne)' }}>
                  Experiencia de Bienestar
                </p>
                <div className={styles.cardItemName}>
                  {selectedItems.length === 0
                    ? '— Seleccioná tratamientos o productos —'
                    : selectedItems.length === 1
                    ? selectedItems[0].title
                    : `${selectedItems[0].title} + ${selectedItems.length - 1} ítem(s) más`}
                </div>
              </div>

              <div className={styles.cardAmount}>
                {totalARS > 0 ? formatARS(totalARS) : '$ 0'}
              </div>

              <div className={styles.cardBottom}>
                <div>
                  <p className={styles.cardToLabel}>PARA</p>
                  <p className={styles.cardTo}>{form.recipientName || 'Agasajado/a'}</p>
                </div>
                <div>
                  <p className={styles.cardFromLabel}>DE PARTE DE</p>
                  <p className={styles.cardFrom}>{form.senderName || 'Tu nombre'}</p>
                </div>
              </div>

              {form.dedication && (
                <p className={styles.cardDedication}>&ldquo;{form.dedication}&rdquo;</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                  Válida por 90 días
                </span>
                <div className={styles.cardCode}>DL-XXXX-XXXX</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
