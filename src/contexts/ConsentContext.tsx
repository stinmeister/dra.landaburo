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

function setBrowserCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<CookieConsentState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: CookieConsentState = JSON.parse(stored);
        setConsentState(parsed);
        // Ensure browser cookie is in sync
        setBrowserCookie(
          COOKIE_NAME,
          JSON.stringify({ a: parsed.analytics ? 1 : 0, m: parsed.marketing ? 1 : 0 })
        );
      }
    } catch {
      // localStorage error (incognito / blocked)
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const setConsent = useCallback(async (analytics: boolean, marketing: boolean) => {
    const newState: CookieConsentState = {
      analytics,
      marketing,
      timestamp: Date.now(),
    };

    // 1. Update State
    setConsentState(newState);

    // 2. Persist in localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // Ignore localStorage errors
    }

    // 3. Persist in browser cookie
    setBrowserCookie(
      COOKIE_NAME,
      JSON.stringify({ a: analytics ? 1 : 0, m: marketing ? 1 : 0 })
    );

    // 4. Send to Supabase via API route
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
      console.warn('No se pudo sincronizar consentimiento con el servidor:', err);
    }

    // 5. Dispatch window event for external listeners
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
      // Ignore
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
