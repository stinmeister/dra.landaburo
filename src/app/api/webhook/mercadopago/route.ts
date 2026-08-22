// Webhook de MercadoPago — actualiza el estado de pago de la orden.
// MP envía notificaciones con topic=payment cuando el estado cambia.
// Verificamos la firma HMAC-SHA256 usando mp_webhook_secret de app_settings.
// Si el secret no está configurado, aceptamos pero logueamos advertencia.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createHmac } from 'crypto';

// Mapeo de estados de MP a nuestros estados internos
const MP_STATUS_MAP: Record<string, string> = {
  approved: 'paid',
  pending: 'pending',
  in_process: 'pending',
  rejected: 'failed',
  cancelled: 'failed',
  refunded: 'refunded',
  charged_back: 'refunded',
};

function verifySignature(
  paymentId: string | number,
  requestId: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  // MP signature format: "ts=<timestamp>,v1=<hash>"
  const tsMatch = signature.match(/ts=(\d+)/);
  const v1Match = signature.match(/v1=([a-f0-9]+)/);
  if (!tsMatch || !v1Match) return false;

  const ts = tsMatch[1];
  const expectedHash = v1Match[1];
  // Formato correcto según docs de MP:
  // id:<payment_id>;request-id:<x-request-id>;ts:<timestamp>;
  const payload = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const computed = createHmac('sha256', secret).update(payload).digest('hex');
  return computed === expectedHash;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let notification: Record<string, unknown>;
  try {
    notification = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  // Solo procesamos notificaciones de tipo "payment"
  if (notification.topic !== 'payment' && notification.type !== 'payment') {
    return NextResponse.json({ ok: true });
  }

  const paymentId = (notification.data as Record<string, unknown>)?.id ?? notification.id;
  if (!paymentId) {
    return NextResponse.json({ error: 'payment_id faltante.' }, { status: 400 });
  }

  // Supabase con service role para actualizar órdenes
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // Leer config de MP (access token + webhook secret)
  const { data: settings } = await supabase
    .from('app_settings')
    .select('mp_access_token, mp_webhook_secret')
    .single();

  if (!settings?.mp_access_token) {
    console.error('[Webhook/MP] mp_access_token no configurado.');
    return NextResponse.json({ error: 'Configuración incompleta.' }, { status: 503 });
  }

  // Verificar firma si hay secret configurado.
  // Usamos paymentId y x-request-id (no el rawBody) según el formato correcto de MP.
  if (settings.mp_webhook_secret) {
    const signature = req.headers.get('x-signature');
    const requestId = req.headers.get('x-request-id') ?? '';
    if (!verifySignature(paymentId, requestId, signature, settings.mp_webhook_secret)) {
      console.warn('[Webhook/MP] Firma inválida — posible request no legítimo.');
      return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
    }
  } else {
    // Sin secret configurado: procesamos igual pero avisamos en logs
    console.warn('[Webhook/MP] mp_webhook_secret no configurado — saltando verificación de firma.');
  }

  // Consultar el estado del pago a la API de MP
  let mpPayment: Record<string, unknown>;
  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${settings.mp_access_token}` },
    });
    if (!mpRes.ok) {
      console.error('[Webhook/MP] Error al obtener pago MP:', mpRes.status);
      return NextResponse.json({ error: 'Error consultando MP.' }, { status: 502 });
    }
    mpPayment = await mpRes.json();
  } catch (err) {
    console.error('[Webhook/MP] Error de red consultando MP:', err);
    return NextResponse.json({ error: 'Error de red.' }, { status: 502 });
  }

  const mpStatus = mpPayment.status as string | undefined;
  const externalRef = mpPayment.external_reference as string | undefined;

  if (!externalRef || !mpStatus) {
    console.warn('[Webhook/MP] Pago sin external_reference o status:', paymentId);
    return NextResponse.json({ ok: true });
  }

  const newStatus = MP_STATUS_MAP[mpStatus] ?? 'pending';

  // Actualizar la orden correspondiente
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_status: newStatus,
      mp_payment_id: String(paymentId),
      updated_at: new Date().toISOString(),
    })
    .eq('id', externalRef);

  if (updateError) {
    console.error('[Webhook/MP] Error actualizando orden:', externalRef, updateError);
    // Retornamos 200 de todas formas para que MP no reintente indefinidamente
  }

  return NextResponse.json({ ok: true });
}
