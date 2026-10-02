'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleStoreConfig } from '@/app/dashboard/operativo/actions';
import styles from './StoreConfigSwitch.module.css';

interface Props {
  checkoutEnabled: boolean;
  shippingEnabled: boolean;
}

export default function StoreConfigSwitch({
  checkoutEnabled: initialCheckout,
  shippingEnabled: initialShipping,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checkoutEnabled, setCheckoutEnabled] = useState(initialCheckout);
  const [shippingEnabled, setShippingEnabled] = useState(initialShipping);

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

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Interruptores de la Tienda</h2>
      <p className={styles.helper}>
        Control general de cobro online y método de envíos (solo visible para administradores).
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
      </div>
    </section>
  );
}
