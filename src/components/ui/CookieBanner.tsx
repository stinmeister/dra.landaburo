'use client';

import { useState, useEffect } from 'react';
import styles from './CookieBanner.module.css';

const STORAGE_KEY = 'cookie_consent_v1';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Solo mostramos si no hay decisión guardada
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const save = (analytics: boolean, marketing: boolean) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics, marketing, ts: Date.now() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Consentimiento de cookies">
      <div className={styles.inner}>
        <p className={styles.text}>
          Usamos cookies para mejorar tu experiencia y analizar el tráfico del sitio.
          Podés aceptar todas o solo las esenciales.{' '}
          <a href="/privacidad" className={styles.link}>Más información</a>.
        </p>
        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={() => save(false, false)}>
            Solo esenciales
          </button>
          <button className={styles.btnPrimary} onClick={() => save(true, true)}>
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  );
}
