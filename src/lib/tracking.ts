/**
 * Módulo Centralizado de Medición y Tracking (GA4 + Meta Pixel)
 * dralandaburo.com
 * 
 * Regla Fundamental:
 * NINGÚN evento se despacha a menos que el paciente haya otorgado consentimiento explícito
 * (analytics para GA4, marketing para Meta Pixel).
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

const STORAGE_KEY = 'cookie_consent_v1';

/**
 * Verifica si el usuario otorgó consentimiento para analítica (GA4)
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return Boolean(parsed.analytics);
  } catch {
    return false;
  }
}

/**
 * Verifica si el usuario otorgó consentimiento para marketing (Meta Pixel)
 */
export function hasMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return Boolean(parsed.marketing);
  } catch {
    return false;
  }
}

/**
 * Envío seguro de PageView a GA4 y Meta Pixel
 */
export function trackPageView(url: string) {
  if (typeof window === 'undefined') return;

  // 1. GA4
  if (hasAnalyticsConsent() && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  }

  // 2. Meta Pixel
  if (hasMarketingConsent() && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
}

/**
 * Evento Genérico GA4
 */
export function trackGA4Event(eventName: string, params: Record<string, any> = {}) {
  if (typeof window === 'undefined') return;
  if (hasAnalyticsConsent() && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

/**
 * Evento Genérico Meta Pixel
 */
export function trackMetaEvent(eventName: string, params: Record<string, any> = {}, isCustom = false) {
  if (typeof window === 'undefined') return;
  if (hasMarketingConsent() && typeof window.fbq === 'function') {
    if (isCustom) {
      window.fbq('trackCustom', eventName, params);
    } else {
      window.fbq('track', eventName, params);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTOS DE NEGOCIO ESPECÍFICOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Clic en "Agendá tu consulta"
 */
export function trackScheduleClick(treatmentName?: string, location: string = 'general') {
  // GA4
  trackGA4Event('agendar_consulta_click', {
    treatment_name: treatmentName || 'general',
    click_location: location,
  });

  // Meta Pixel (Lead / Contact)
  trackMetaEvent('Contact', {
    content_name: treatmentName || 'Consulta Médica',
    content_category: 'Agendamiento',
    location,
  });
}

/**
 * 2. Clic en Botón Flotante de WhatsApp
 */
export function trackWhatsAppClick(location: string = 'floating_button') {
  // GA4
  trackGA4Event('whatsapp_click', {
    click_location: location,
  });

  // Meta Pixel (Contact)
  trackMetaEvent('Contact', {
    content_name: 'WhatsApp Click',
    content_category: 'Mensajería Directa',
    location,
  });
}

/**
 * 3. Clic en "Agregar al carrito" (Tienda)
 */
export interface CartProductParam {
  id: string | number;
  name: string;
  price_ars: number;
  quantity?: number;
  category?: string | null;
}

export function trackAddToCart(product: CartProductParam) {
  const qty = product.quantity || 1;
  const value = product.price_ars * qty;

  // GA4
  trackGA4Event('add_to_cart', {
    currency: 'ARS',
    value,
    items: [
      {
        item_id: String(product.id),
        item_name: product.name,
        item_category: product.category || 'Skincare',
        price: product.price_ars,
        quantity: qty,
      },
    ],
  });

  // Meta Pixel
  trackMetaEvent('AddToCart', {
    content_ids: [String(product.id)],
    content_name: product.name,
    content_type: 'product',
    value,
    currency: 'ARS',
  });
}

/**
 * 4. Inicio de Checkout (Carrito o Gift Card)
 */
export function trackBeginCheckout(
  items: Array<{ id: string | number; name: string; price_ars: number; quantity: number }>,
  totalARS: number
) {
  // GA4
  trackGA4Event('begin_checkout', {
    currency: 'ARS',
    value: totalARS,
    items: items.map((item) => ({
      item_id: String(item.id),
      item_name: item.name,
      price: item.price_ars,
      quantity: item.quantity,
    })),
  });

  // Meta Pixel
  trackMetaEvent('InitiateCheckout', {
    content_ids: items.map((i) => String(i.id)),
    num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    value: totalARS,
    currency: 'ARS',
  });
}

/**
 * 5. Clic en "Configurar Gift Card"
 */
export function trackConfigureGiftCard() {
  // GA4
  trackGA4Event('gift_card_configure', {
    category: 'Gift Card',
  });

  // Meta Pixel
  trackMetaEvent('GiftCardConfigure', {
    content_category: 'Gift Card',
  }, true);
}

/**
 * 6. Formulario de Contacto Completado (Lead)
 */
export function trackContactLead(treatment?: string) {
  // GA4
  trackGA4Event('generate_lead', {
    event_category: 'Contact',
    event_label: treatment || 'Consulta General',
  });

  // Meta Pixel
  trackMetaEvent('Lead', {
    content_name: treatment || 'Consulta General',
    content_category: 'Formulario de Contacto',
  });
}

/**
 * 7. Compra Finalizada (Purchase) — Preparado para confirmación post-checkout
 */
export function trackPurchase(data: {
  id: string;
  value: number;
  items?: Array<{ id: string | number; name: string; price_ars: number; quantity: number }>;
}) {
  // GA4
  trackGA4Event('purchase', {
    transaction_id: data.id,
    currency: 'ARS',
    value: data.value,
    items: (data.items || []).map((i) => ({
      item_id: String(i.id),
      item_name: i.name,
      price: i.price_ars,
      quantity: i.quantity,
    })),
  });

  // Meta Pixel
  trackMetaEvent('Purchase', {
    value: data.value,
    currency: 'ARS',
    content_type: 'product',
  });
}
