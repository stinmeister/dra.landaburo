'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsent } from '@/contexts/ConsentContext';
import { trackPageView } from '@/lib/tracking';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1044620534874370';

export default function TrackingScripts() {
  const { consent, isLoaded } = useConsent();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gaInitializedRef = useRef(false);
  const pixelInitializedRef = useRef(false);
  const initialPageViewTrackedRef = useRef(false);

  // 1. Inicialización condicional de GA4
  useEffect(() => {
    if (!isLoaded || !consent?.analytics || !GA_ID) return;
    if (gaInitializedRef.current) return;

    // Verificar si ya existe el script en el DOM
    if (!document.getElementById('ga-script')) {
      const script = document.createElement('script');
      script.id = 'ga-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer?.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', GA_ID, {
        page_path: window.location.pathname,
        anonymize_ip: true,
      });

      gaInitializedRef.current = true;
    }
  }, [consent?.analytics, isLoaded]);

  // 2. Inicialización condicional de Meta Pixel
  useEffect(() => {
    if (!isLoaded || !consent?.marketing || !PIXEL_ID) return;
    if (pixelInitializedRef.current) return;

    if (!document.getElementById('meta-pixel-script')) {
      /* eslint-disable */
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.id = 'meta-pixel-script';
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */

      if (typeof window.fbq === 'function') {
        window.fbq('init', PIXEL_ID);
        window.fbq('track', 'PageView');
      }

      pixelInitializedRef.current = true;
    }
  }, [consent?.marketing, isLoaded]);

  // 3. Tracking de cambios de ruta en SPA (Next.js Navigation)
  useEffect(() => {
    if (!isLoaded) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    // Evitar duplicar el pageview inicial si los scripts ya lo hicieron en init
    if (!initialPageViewTrackedRef.current) {
      initialPageViewTrackedRef.current = true;
      return;
    }

    trackPageView(url);
  }, [pathname, searchParams, isLoaded, consent]);

  return null;
}
