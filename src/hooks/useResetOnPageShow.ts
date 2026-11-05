'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Resetea estados transitorios (ej. `loading = true` tras `window.location.href = init_point`)
 * cuando la compradora vuelve atrás desde Mercado Pago y el navegador restaura la página
 * desde bfcache (`pageshow` con `event.persisted`) o retoma visibilidad de la pestaña.
 */
export function useResetOnPageShow(onReset: () => void) {
  const redirectingRef = useRef(false);
  const onResetRef = useRef(onReset);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  const markRedirecting = useCallback(() => {
    redirectingRef.current = true;
  }, []);

  useEffect(() => {
    const triggerReset = () => {
      redirectingRef.current = false;
      onResetRef.current();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted || redirectingRef.current) {
        triggerReset();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && redirectingRef.current) {
        triggerReset();
      }
    };

    const handlePopState = () => {
      if (redirectingRef.current) {
        triggerReset();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return { markRedirecting };
}
