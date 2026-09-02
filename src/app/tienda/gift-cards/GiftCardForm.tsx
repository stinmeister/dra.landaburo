'use client';

import { useState } from 'react';
import type { GiftCardItem } from './page';
import styles from './gift-cards.module.css';

interface FormState {
  selectedItem: GiftCardItem | null;
  senderName: string;
  senderEmail: string;
  recipientName: string;
  dedication: string;
  deliveryMethod: 'digital' | 'fisica';
}

export default function GiftCardForm({ catalog }: { catalog: GiftCardItem[] }) {
  const [form, setForm] = useState<FormState>({
    selectedItem: null,
    senderName: '',
    senderEmail: '',
    recipientName: '',
    dedication: '',
    deliveryMethod: 'digital',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'treatment' | 'product'>('all');

  const formatARS = (n: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(n);

  const filteredCatalog = catalog.filter(
    (item) => filter === 'all' || item.type === filter
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.selectedItem) { setError('Seleccioná un tratamiento o producto.'); return; }
    if (!form.senderName.trim() || !form.senderEmail.trim()) {
      setError('Completá tu nombre y email.'); return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/gift-cards/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // El amount_ars viene del precio real del item, no lo ingresa el comprador
          amount_ars: form.selectedItem.price_ars,
          treatment_id: form.selectedItem.type === 'treatment' ? form.selectedItem.id : null,
          product_id: form.selectedItem.type === 'product' ? form.selectedItem.id : null,
          sender_name: form.senderName.trim(),
          sender_email: form.senderEmail.trim().toLowerCase(),
          recipient_name: form.recipientName.trim() || null,
          dedication: form.dedication.trim() || null,
          delivery_method: form.deliveryMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al procesar. Intentá de nuevo.'); return; }
      window.location.href = data.init_point;
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Regalo con propósito</span>
          <h1 className={styles.heroTitle}>Gift Cards de Bienestar</h1>
          <p className={styles.heroSubtitle}>
            Elegí un tratamiento o producto y regalá una experiencia de cuidado real.
            La Gift Card llega por email lista para usar.
          </p>
        </div>
      </section>

      <section className={styles.builderSection}>
        <div className={styles.builderGrid}>
          {/* Form */}
          <div className={styles.formCol}>
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <h2 className={styles.formTitle}>Configurar regalo</h2>

              {/* Filter tabs */}
              <div className={styles.filterTabs}>
                {(['all', 'treatment', 'product'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'Todo' : f === 'treatment' ? 'Tratamientos' : 'Productos'}
                  </button>
                ))}
              </div>

              {/* Catalog selector */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>¿Qué querés regalar? *</label>
                <div className={styles.catalogGrid}>
                  {filteredCatalog.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.catalogBtn} ${
                        form.selectedItem?.id === item.id ? styles.catalogBtnSelected : ''
                      }`}
                      onClick={() => setForm((f) => ({ ...f, selectedItem: item }))}
                    >
                      <span className={styles.catalogBtnType}>
                        {item.type === 'treatment' ? '💆 Tratamiento' : '🧴 Producto'}
                      </span>
                      <span className={styles.catalogBtnName}>{item.name}</span>
                      <span className={styles.catalogBtnPrice}>{formatARS(item.price_ars)}</span>
                    </button>
                  ))}
                </div>
                {filteredCatalog.length === 0 && (
                  <p className={styles.emptyMsg}>No hay items disponibles en esta categoría.</p>
                )}
              </div>

              {/* Sender */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="senderName">Tu nombre *</label>
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
                  placeholder="Para enviarte la confirmación"
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
                  placeholder="¿A quién es el regalo?"
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
                  placeholder="Escribí un mensaje especial..."
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
                          ? 'Por email, al instante'
                          : 'Retirá en el consultorio'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading
                  ? 'Procesando...'
                  : `Comprar Gift Card${form.selectedItem ? ` — ${formatARS(form.selectedItem.price_ars)}` : ''} →`}
              </button>
              <p className={styles.footNote}>
                Pago seguro vía MercadoPago. Vigencia 180 días desde la confirmación.
              </p>
            </form>
          </div>

          {/* Preview */}
          <div className={styles.previewCol}>
            <p className={styles.previewLabel}>Vista previa de tu regalo</p>
            <div className={styles.cardPreview}>
              <div className={styles.cardTop}>
                <span className={styles.cardBrand}>Dra. Landaburo</span>
                <span className={styles.cardSubBrand}>Medicina Estética &amp; Dermatología</span>
              </div>
              <div className={styles.cardItemName}>
                {form.selectedItem ? form.selectedItem.name : '— Elegí un tratamiento o producto —'}
              </div>
              <div className={styles.cardAmount}>
                {form.selectedItem ? formatARS(form.selectedItem.price_ars) : ''}
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
              <div className={styles.cardCode}>DL-XXXX-XXXX</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
