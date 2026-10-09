import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export interface MetaCapiOrderItem {
  product_id?: string;
  id?: string;
  product_name: string;
  quantity: number;
  unit_price_ars: number;
}

export interface MetaCapiOrder {
  id: string;
  order_number?: string;
  buyer_name?: string | null;
  customer_name?: string | null;
  buyer_email?: string | null;
  customer_email?: string | null;
  buyer_phone?: string | null;
  customer_phone?: string | null;
  delivery_city?: string | null;
  total_ars: number | string;
}

/**
 * Hashea con SHA-256 en minúsculas cadenas normalizadas para Meta CAPI (PII).
 */
function sha256(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  if (!clean) return null;
  return createHash('sha256').update(clean).digest('hex');
}

/**
 * Normaliza número telefónico a formato internacional E.164 (dígitos puros).
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // Si no incluye prefijo de país 54 (Argentina), anteponerlo
  if (!digits.startsWith('54') && digits.length <= 11) {
    digits = '54' + digits;
  }
  return digits;
}

/**
 * Divide nombre completo en nombre y apellido normalizados.
 */
function splitName(fullName: string | null | undefined): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Normaliza ciudad eliminando diacríticos/acentos.
 */
function normalizeCity(city: string | null | undefined): string | null {
  if (!city) return null;
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Persiste el estado de envío de CAPI en la tabla orders (si existen las columnas).
 * Diseñado a prueba de fallos si las columnas aún no han sido migradas mediante DDL.
 */
async function recordCapiStatus(
  orderId: string,
  sent: boolean,
  error: string | null
): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: updErr } = await supabase
      .from('orders')
      .update({
        meta_capi_sent: sent,
        meta_capi_error: error,
        meta_capi_attempted_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updErr) {
      // Si las columnas aún no existen en el esquema SQL de Supabase (esperando DDL)
      if (updErr.code === 'PGRST204' || updErr.message.includes('column')) {
        console.warn(
          `[Meta CAPI] Nota: Columnas meta_capi_* pendientes de DDL en tabla orders. Estado en memoria: sent=${sent}, error=${error}`
        );
      } else {
        console.error('[Meta CAPI] Error actualizando estado de CAPI en orders:', updErr.message);
      }
    }
  } catch (err: any) {
    console.error('[Meta CAPI] Excepción al actualizar estado en orders:', err?.message);
  }
}

/**
 * Envía el evento server-side 'Purchase' a Meta Conversions API (CAPI).
 * Desacoplado y ejecutado en el webhook del servidor tras la confirmación del pago en Mercado Pago.
 */
export async function sendMetaPurchaseCapi({
  order,
  items,
  externalRef,
}: {
  order: MetaCapiOrder;
  items: MetaCapiOrderItem[];
  externalRef?: string;
}): Promise<{ success: boolean; error?: string }> {
  const pixelId =
    process.env.META_PIXEL_ID ||
    process.env.NEXT_PUBLIC_META_PIXEL_ID ||
    '1044620534874370';

  const capiToken = process.env.META_CONVERSIONS_API_TOKEN;

  if (!capiToken || capiToken.trim().length === 0) {
    const warning =
      'META_CONVERSIONS_API_TOKEN no está configurado en las variables de entorno del servidor.';
    console.warn(`[Meta CAPI] ${warning} Omitiendo despacho para orden ${order.order_number || order.id}.`);
    await recordCapiStatus(order.id, false, warning);
    return { success: false, error: warning };
  }

  try {
    const rawEmail = order.buyer_email || order.customer_email;
    const rawPhone = order.buyer_phone || order.customer_phone;
    const rawName = order.buyer_name || order.customer_name;
    const rawCity = order.delivery_city;

    const emailHash = sha256(rawEmail);
    const phoneNorm = normalizePhone(rawPhone);
    const phoneHash = sha256(phoneNorm);
    const { firstName, lastName } = splitName(rawName);
    const fnHash = sha256(firstName);
    const lnHash = sha256(lastName);
    const cityNorm = normalizeCity(rawCity);
    const ctHash = sha256(cityNorm);
    const countryHash = sha256('ar');

    const userData: Record<string, string[]> = {};
    if (emailHash) userData.em = [emailHash];
    if (phoneHash) userData.ph = [phoneHash];
    if (fnHash) userData.fn = [fnHash];
    if (lnHash) userData.ln = [lnHash];
    if (ctHash) userData.ct = [ctHash];
    if (countryHash) userData.country = [countryHash];

    const eventId = externalRef || order.id;
    const totalARS = Number(order.total_ars || 0);

    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: 'https://dralandaburo.com/tienda',
          action_source: 'website',
          user_data: userData,
          custom_data: {
            currency: 'ARS',
            value: totalARS,
            content_type: 'product',
            contents: items.map((i) => ({
              id: String(i.product_id || i.id || i.product_name),
              quantity: Number(i.quantity || 1),
              item_price: Number(i.unit_price_ars || 0),
              title: i.product_name,
            })),
          },
        },
      ],
    };

    const graphUrl = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(
      capiToken
    )}`;

    const res = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Meta CAPI] Error en Meta Graph API (${res.status}):`, errText);
      await recordCapiStatus(order.id, false, `HTTP ${res.status}: ${errText}`);
      return { success: false, error: errText };
    }

    const resJson = await res.json().catch(() => ({}));
    console.log(
      `[Meta CAPI] Purchase enviado con éxito para orden ${order.order_number || order.id}. Trace ID: ${
        resJson.fbtrace_id || 'OK'
      }`
    );

    await recordCapiStatus(order.id, true, null);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || 'Error desconocido despachando Meta CAPI';
    console.error('[Meta CAPI] Excepción de red despachando Purchase:', errorMsg);
    await recordCapiStatus(order.id, false, errorMsg);
    return { success: false, error: errorMsg };
  }
}
