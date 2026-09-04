'use client';

import { useConsent } from '@/contexts/ConsentContext';
import styles from './CookieBanner.module.css';

export default function CookieBanner() {
  const { consent, isLoaded, setConsent } = useConsent();

  // No mostrar mientras carga el estado local o si el paciente ya tomó una decisión
  if (!isLoaded || consent !== null) {
    return null;
  }

  const handleAcceptAll = () => {
    setConsent(true, true);
  };

  const handleRejectNonEssential = () => {
    setConsent(false, false);
  };

  return (
    <aside
      className={styles.banner}
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
    >
      <div className={styles.inner}>
        <div className={styles.textBlock}>
          <p id="cookie-banner-title" className={styles.title}>
            Tu privacidad y cuidado médico
          </p>
          <p id="cookie-banner-desc" className={styles.text}>
            Utilizamos cookies esenciales para el funcionamiento seguro del sitio. Con tu consentimiento,
            también utilizamos cookies de analítica y optimización para mejorar la experiencia de nuestras pacientes.
            Podés aceptar todas o mantener únicamente las necesarias.
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleRejectNonEssential}
            aria-label="Rechazar cookies no esenciales y usar solo las necesarias"
          >
            Solo necesarias
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleAcceptAll}
            aria-label="Aceptar todas las cookies"
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </aside>
  );
}
