'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleStoreConfig, updateAttentionHours } from '@/app/dashboard/operativo/actions';
import styles from './StoreConfigSwitch.module.css';

interface Props {
  checkoutEnabled: boolean;
  shippingEnabled: boolean;
  attentionHours?: string;
  allowOversellOnline?: boolean;
}

export default function StoreConfigSwitch({
  checkoutEnabled: initialCheckout,
  shippingEnabled: initialShipping,
  attentionHours: initialHours = 'Lun-Vier: 10:00 – 19:00 hs, Sáb: Solo con cita previa',
  allowOversellOnline: initialOversell = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checkoutEnabled, setCheckoutEnabled] = useState(initialCheckout);
  const [shippingEnabled, setShippingEnabled] = useState(initialShipping);
  const [allowOversellOnline, setAllowOversellOnline] = useState(initialOversell);
  const [attentionHours, setAttentionHours] = useState(initialHours);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleToggleCheckout = () => {
    const nextVal = !checkoutEnabled;
    setCheckoutEnabled(nextVal);
    startTransition(async () => {
      try {
        await toggleStoreConfig('checkout_enabled', nextVal);
        router.refresh();
      } catch (err: any) {
        setCheckoutEnabled(!nextVal);
        alert(err?.message || 'Error actualizando checkout_enabled');
      }
    });
  };

  const handleToggleShipping = () => {
    const nextVal = !shippingEnabled;
    setShippingEnabled(nextVal);
    startTransition(async () => {
      try {
        await toggleStoreConfig('shipping_enabled', nextVal);
        router.refresh();
      } catch (err: any) {
        setShippingEnabled(!nextVal);
        alert(err?.message || 'Error actualizando shipping_enabled');
      }
    });
  };

  const handleToggleOversell = () => {
    const nextVal = !allowOversellOnline;
    setAllowOversellOnline(nextVal);
    startTransition(async () => {
      try {
        await toggleStoreConfig('allow_oversell_online', nextVal);
        router.refresh();
      } catch (err: any) {
        setAllowOversellOnline(!nextVal);
        alert(err?.message || 'Error actualizando allow_oversell_online');
      }
    });
  };

  const handleSaveHours = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateAttentionHours(attentionHours);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        router.refresh();
      } catch (err: any) {
        alert(err?.message || 'Error actualizando horario de atención');
      }
    });
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Configuración y Políticas de la Tienda</h2>
      <p className={styles.helper}>
        Control general de cobro online, envíos, sobreventa y horarios de consultorio (solo visible para administradores).
      </p>

      <div className={styles.switchList}>
        <div className={styles.switchRow}>
          <div className={styles.switchMeta}>
            <span className={styles.switchLabel}>Cobro online con Mercado Pago</span>
            <span className={styles.switchDesc}>
              {checkoutEnabled
                ? 'Activo — las pacientes pueden pagar con Mercado Pago en el carrito.'
                : 'Inactivo — el botón en el carrito deriva a WhatsApp.'}
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${
              checkoutEnabled ? styles.toggleBtnOn : styles.toggleBtnOff
            }`}
            onClick={handleToggleCheckout}
            disabled={isPending}
            aria-pressed={checkoutEnabled}
            aria-label="Alternar cobro online"
          >
            <span
              className={`${styles.toggleKnob} ${
                checkoutEnabled ? styles.toggleKnobOn : styles.toggleKnobOff
              }`}
            />
          </button>
        </div>

        <div className={styles.switchRow}>
          <div className={styles.switchMeta}>
            <span className={styles.switchLabel}>Envíos a domicilio</span>
            <span className={styles.switchDesc}>
              {shippingEnabled
                ? 'Activo — el carrito solicita datos de envío y dirección.'
                : 'Inactivo — solo se ofrece retiro en consultorio (gratis).'}
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${
              shippingEnabled ? styles.toggleBtnOn : styles.toggleBtnOff
            }`}
            onClick={handleToggleShipping}
            disabled={isPending}
            aria-pressed={shippingEnabled}
            aria-label="Alternar envíos a domicilio"
          >
            <span
              className={`${styles.toggleKnob} ${
                shippingEnabled ? styles.toggleKnobOn : styles.toggleKnobOff
              }`}
            />
          </button>
        </div>

        <div className={styles.switchRow}>
          <div className={styles.switchMeta}>
            <span className={styles.switchLabel}>Sobreventa online (stock negativo temporal)</span>
            <span className={styles.switchDesc}>
              {allowOversellOnline
                ? 'Permitida — ventas online cobradas no se bloquean por falta de stock y generan alerta operativa.'
                : 'Bloqueada — el sistema rechaza compras si el stock es insuficiente.'}
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${
              allowOversellOnline ? styles.toggleBtnOn : styles.toggleBtnOff
            }`}
            onClick={handleToggleOversell}
            disabled={isPending}
            aria-pressed={allowOversellOnline}
            aria-label="Alternar sobreventa online"
          >
            <span
              className={`${styles.toggleKnob} ${
                allowOversellOnline ? styles.toggleKnobOn : styles.toggleKnobOff
              }`}
            />
          </button>
        </div>

        <form onSubmit={handleSaveHours} className={styles.inputGroup}>
          <label className={styles.switchLabel} htmlFor="attentionHoursInput">
            Horario de atención del consultorio (Footer)
          </label>
          <span className={styles.switchDesc}>
            Se muestra automáticamente al pie de todas las páginas públicas del sitio.
          </span>
          <input
            id="attentionHoursInput"
            type="text"
            className={styles.textInput}
            value={attentionHours}
            onChange={(e) => setAttentionHours(e.target.value)}
            disabled={isPending}
            placeholder="Ej: Lun-Vier: 10:00 – 19:00 hs, Sáb: Solo con cita previa"
          />
          <button type="submit" className={styles.saveBtn} disabled={isPending}>
            {isPending ? 'Guardando...' : saveSuccess ? 'Guardado ✓' : 'Guardar Horario'}
          </button>
        </form>
      </div>
    </section>
  );
}
