'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface CookieConsentState {
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

interface ConsentContextType {
  consent: CookieConsentState | null;
  isLoaded: boolean;
  setConsent: (analytics: boolean, marketing: boolean) => Promise<void>;
  resetConsent: () => void;
}

const STORAGE_KEY = 'cookie_consent_v1';
const COOKIE_NAME = 'cookie_consent';

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

function getBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

function setBrowserCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  const hostname = window.location.hostname;
  const domainPart = hostname.includes('dralandaburo.com') ? ';domain=.dralandaburo.com' : '';
  document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/${domainPart};SameSite=Lax`;
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<CookieConsentState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let resolvedState: CookieConsentState | null = null;

    // 1. Intentar leer de localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        resolvedState = JSON.parse(stored);
      }
    } catch {
      // localStorage bloqueado / incógnito
    }

    // 2. Si no estaba en localStorage, intentar leer de la cookie HTTP / document.cookie
    if (!resolvedState) {
      try {
        const rawCookie = getBrowserCookie(COOKIE_NAME);
        if (rawCookie) {
          const cookieObj = JSON.parse(rawCookie);
          if (cookieObj && typeof cookieObj === 'object') {
            resolvedState = {
              analytics: Boolean(cookieObj.a || cookieObj.analytics_accepted),
              marketing: Boolean(cookieObj.m || cookieObj.marketing_accepted),
              timestamp: Date.now(),
            };
            // Re-sincronizar en localStorage para velocidad en próximas visitas
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(resolvedState));
            } catch {}
          }
        }
      } catch {
        // Error parseando cookie
      }
    }

    if (resolvedState) {
      setConsentState(resolvedState);
      // Garantizar que la cookie esté fresca por 1 año
      setBrowserCookie(
        COOKIE_NAME,
        JSON.stringify({ a: resolvedState.analytics ? 1 : 0, m: resolvedState.marketing ? 1 : 0 })
      );
    }

    setIsLoaded(true);
  }, []);

  const setConsent = useCallback(async (analytics: boolean, marketing: boolean) => {
    const newState: CookieConsentState = {
      analytics,
      marketing,
      timestamp: Date.now(),
    };

    // 1. Actualizar estado en React
    setConsentState(newState);

    // 2. Persistir en localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // Ignorar errores de localStorage
    }

    // 3. Persistir en cookie del navegador (12 meses de validez)
    setBrowserCookie(
      COOKIE_NAME,
      JSON.stringify({ a: analytics ? 1 : 0, m: marketing ? 1 : 0 })
    );

    // 4. Enviar a Supabase para registro de auditoría médica
    try {
      await fetch('/api/cookies/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analytics_accepted: analytics,
          marketing_accepted: marketing,
        }),
      });
    } catch (err) {
      console.warn('[ConsentContext] Aviso: No se pudo sincronizar consentimiento con el servidor:', err);
    }

    // 5. Despachar evento para Meta Pixel / GA4
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cookie_consent_updated', { detail: newState })
      );
    }
  }, []);

  const resetConsent = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar
    }
    if (typeof document !== 'undefined') {
      const hostname = window.location.hostname;
      const domainPart = hostname.includes('dralandaburo.com') ? ';domain=.dralandaburo.com' : '';
      document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${domainPart}`;
    }
    setConsentState(null);
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, isLoaded, setConsent, resetConsent }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}
