/**
 * Ejecución y manejo de errores de preferencias de Mercado Pago (Checkout Tienda y Gift Cards).
 * Garantiza:
 * 1. Fallo explícito si falta NEXT_PUBLIC_SITE_URL en producción (nunca cae a localhost en silencio).
 * 2. Cero órdenes / gift cards huérfanas en 'pending' cuando MP rechaza o falla el despacho.
 * 3. Logs estructurados con código HTTP y { message, error, cause }, jamás headers ni tokens.
 * 4. Mensajes amables para la compradora con invitación a WhatsApp cuando el fallo no es transitorio.
 */

export const BUYER_MP_REJECTED_MESSAGE =
  'No pudimos iniciar el cobro online en este momento. Escribinos por WhatsApp y te ayudamos a completar tu compra enseguida.';

export const BUYER_MP_NETWORK_MESSAGE =
  'No pudimos conectar con Mercado Pago en este momento. Podés volver a intentar en unos segundos o escribirnos por WhatsApp para completar tu compra.';

export const BUYER_SITE_URL_MISCONFIGURED_MESSAGE =
  'El cobro online no está disponible temporalmente. Escribinos por WhatsApp y te ayudamos a completar tu compra.';

export type ResolvedSiteUrl =
  | { ok: true; siteUrl: string }
  | { ok: false; reason: string };

export function resolveCheckoutSiteUrl(
  env: NodeJS.ProcessEnv = process.env
): ResolvedSiteUrl {
  const raw = (env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  const isProd = env.NODE_ENV === 'production';

  if (isProd) {
    if (!raw) {
      return {
        ok: false,
        reason: 'NEXT_PUBLIC_SITE_URL no está configurada en producción.',
      };
    }
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(raw)) {
      return {
        ok: false,
        reason: 'NEXT_PUBLIC_SITE_URL apunta a localhost en producción.',
      };
    }
    if (!/^https:\/\//i.test(raw)) {
      return {
        ok: false,
        reason: 'NEXT_PUBLIC_SITE_URL debe usar https:// en producción.',
      };
    }
    return { ok: true, siteUrl: raw };
  }

  return { ok: true, siteUrl: raw || 'http://localhost:3000' };
}

export interface SafeMpErrorDetail {
  message: string | null;
  error: string | null;
  cause: unknown;
}

function scrubSecrets(text: string): string {
  return text
    .replace(/(APP_USR-|TEST-)[A-Za-z0-9_-]+/g, '<REDACTADO>')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer <REDACTADO>');
}

export function extractSafeMpErrorDetail(rawText: string): SafeMpErrorDetail {
  const cleaned = scrubSecrets(rawText || '');
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      return {
        message: typeof parsed.message === 'string' ? scrubSecrets(parsed.message) : null,
        error: typeof parsed.error === 'string' ? scrubSecrets(parsed.error) : null,
        cause: parsed.cause ?? null,
      };
    }
  } catch {
    // Cuerpo no JSON
  }
  return {
    message: cleaned.trim().slice(0, 300) || 'sin detalle',
    error: null,
    cause: null,
  };
}

export interface MpLogger {
  error: (...args: unknown[]) => void;
}

export interface DispatchOrderPreferenceParams {
  orderId: string;
  orderNumber: string;
  mpAccessToken: string;
  mpBody: unknown;
  fetchFn?: typeof fetch;
  markOrderRejected: (orderId: string) => Promise<void>;
  savePreferenceId?: (orderId: string, preferenceId: string) => Promise<void>;
  logger?: MpLogger;
}

export type DispatchPreferenceResult =
  | {
      ok: true;
      initPoint: string;
      preferenceId: string | null;
    }
  | {
      ok: false;
      httpStatus: number;
      error: string;
      code: 'mp_preference_rejected' | 'mp_network_error';
      canRetry: boolean;
    };

export async function dispatchOrderPreferenceToMp(
  params: DispatchOrderPreferenceParams
): Promise<DispatchPreferenceResult> {
  const {
    orderId,
    orderNumber,
    mpAccessToken,
    mpBody,
    fetchFn = fetch,
    markOrderRejected,
    savePreferenceId,
    logger = console,
  } = params;

  let mpResponse: Response;
  try {
    mpResponse = await fetchFn('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(mpBody),
    });
  } catch (fetchErr) {
    const netMsg =
      fetchErr instanceof Error ? scrubSecrets(fetchErr.message) : 'Error de red';
    logger.error('[Checkout/MP] Error de red al llamar a Mercado Pago:', {
      orderId,
      orderNumber,
      message: netMsg,
    });
    await markOrderRejected(orderId);
    return {
      ok: false,
      httpStatus: 502,
      error: BUYER_MP_NETWORK_MESSAGE,
      code: 'mp_network_error',
      canRetry: true,
    };
  }

  if (!mpResponse.ok) {
    const rawError = await mpResponse.text().catch(() => '');
    const detail = extractSafeMpErrorDetail(rawError);
    logger.error('[Checkout/MP] Preferencia rechazada por Mercado Pago:', {
      orderId,
      orderNumber,
      httpStatus: mpResponse.status,
      message: detail.message,
      error: detail.error,
      cause: detail.cause,
    });
    await markOrderRejected(orderId);
    return {
      ok: false,
      httpStatus: 502,
      error: BUYER_MP_REJECTED_MESSAGE,
      code: 'mp_preference_rejected',
      canRetry: false,
    };
  }

  const mpData = await mpResponse.json().catch(() => null);
  if (!mpData || typeof mpData.init_point !== 'string' || !mpData.init_point) {
    logger.error('[Checkout/MP] Respuesta de Mercado Pago sin init_point:', {
      orderId,
      orderNumber,
      httpStatus: mpResponse.status,
      message: 'missing_init_point',
      error: 'invalid_mp_response',
      cause: null,
    });
    await markOrderRejected(orderId);
    return {
      ok: false,
      httpStatus: 502,
      error: BUYER_MP_REJECTED_MESSAGE,
      code: 'mp_preference_rejected',
      canRetry: false,
    };
  }

  const preferenceId = typeof mpData.id === 'string' ? mpData.id : null;
  if (preferenceId && savePreferenceId) {
    try {
      await savePreferenceId(orderId, preferenceId);
    } catch {
      // No interrumpir redirección si falla guardar mp_preference_id
    }
  }

  return {
    ok: true,
    initPoint: mpData.init_point,
    preferenceId,
  };
}

export interface DispatchGiftCardPreferenceParams {
  giftCardId: string;
  giftCardCode: string;
  mpAccessToken: string;
  mpBody: unknown;
  fetchFn?: typeof fetch;
  markGiftCardCancelled: (giftCardId: string) => Promise<void>;
  logger?: MpLogger;
}

export async function dispatchGiftCardPreferenceToMp(
  params: DispatchGiftCardPreferenceParams
): Promise<DispatchPreferenceResult> {
  const {
    giftCardId,
    giftCardCode,
    mpAccessToken,
    mpBody,
    fetchFn = fetch,
    markGiftCardCancelled,
    logger = console,
  } = params;

  let mpResponse: Response;
  try {
    mpResponse = await fetchFn('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(mpBody),
    });
  } catch (fetchErr) {
    const netMsg =
      fetchErr instanceof Error ? scrubSecrets(fetchErr.message) : 'Error de red';
    logger.error('[GiftCard/Checkout] Error de red al llamar a Mercado Pago:', {
      giftCardId,
      code: giftCardCode,
      message: netMsg,
    });
    await markGiftCardCancelled(giftCardId);
    return {
      ok: false,
      httpStatus: 502,
      error: BUYER_MP_NETWORK_MESSAGE,
      code: 'mp_network_error',
      canRetry: true,
    };
  }

  if (!mpResponse.ok) {
    const rawError = await mpResponse.text().catch(() => '');
    const detail = extractSafeMpErrorDetail(rawError);
    logger.error('[GiftCard/Checkout] Preferencia rechazada por Mercado Pago:', {
      giftCardId,
      code: giftCardCode,
      httpStatus: mpResponse.status,
      message: detail.message,
      error: detail.error,
      cause: detail.cause,
    });
    await markGiftCardCancelled(giftCardId);
    return {
      ok: false,
      httpStatus: 502,
      error: BUYER_MP_REJECTED_MESSAGE,
      code: 'mp_preference_rejected',
      canRetry: false,
    };
  }

  const mpData = await mpResponse.json().catch(() => null);
  if (!mpData || typeof mpData.init_point !== 'string' || !mpData.init_point) {
    logger.error('[GiftCard/Checkout] Respuesta de Mercado Pago sin init_point:', {
      giftCardId,
      code: giftCardCode,
      httpStatus: mpResponse.status,
      message: 'missing_init_point',
      error: 'invalid_mp_response',
      cause: null,
    });
    await markGiftCardCancelled(giftCardId);
    return {
      ok: false,
      httpStatus: 502,
      error: BUYER_MP_REJECTED_MESSAGE,
      code: 'mp_preference_rejected',
      canRetry: false,
    };
  }

  return {
    ok: true,
    initPoint: mpData.init_point,
    preferenceId: typeof mpData.id === 'string' ? mpData.id : null,
  };
}
