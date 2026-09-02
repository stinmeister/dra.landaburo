// Webhook de MercadoPago — actualiza el estado de pago de la orden O de la gift card.
// MP envía notificaciones con topic=payment cuando el estado cambia.
// Verificamos la firma HMAC-SHA256 usando mp_webhook_secret de app_settings.
// Identificamos gift cards por external_reference que comienza con "giftcard:"
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createHmac } from 'crypto';

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
  const tsMatch = signature.match(/ts=(\d+)/);
  const v1Match = signature.match(/v1=([a-f0-9]+)/);
  if (!tsMatch || !v1Match) return false;
  const ts = tsMatch[1];
  const expectedHash = v1Match[1];
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

  if (notification.topic !== 'payment' && notification.type !== 'payment') {
    return NextResponse.json({ ok: true });
  }

  const rawPaymentId = (notification.data as Record<string, unknown>)?.id ?? notification.id;
  if (!rawPaymentId) {
    return NextResponse.json({ error: 'payment_id faltante.' }, { status: 400 });
  }
  const paymentId = String(rawPaymentId);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { data: settings } = await supabase
    .from('app_settings')
    .select('mp_access_token, mp_webhook_secret')
    .single();

  if (!settings?.mp_access_token) {
    console.error('[Webhook/MP] mp_access_token no configurado.');
    return NextResponse.json({ error: 'Configuración incompleta.' }, { status: 503 });
  }

  if (settings.mp_webhook_secret) {
    const signature = req.headers.get('x-signature');
    const requestId = req.headers.get('x-request-id') ?? '';
    if (!verifySignature(paymentId, requestId, signature, settings.mp_webhook_secret)) {
      console.warn('[Webhook/MP] Firma inválida — posible request no legítimo.');
      return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
    }
  } else {
    console.warn('[Webhook/MP] mp_webhook_secret no configurado — saltando verificación de firma.');
  }

  // Consult MP for the actual payment data
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

  // ----- GIFT CARD FLOW -----
  if (externalRef.startsWith('giftcard:')) {
    const giftCardId = externalRef.replace('giftcard:', '');

    if (mpStatus === 'approved') {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 180);

      const { data: card, error: updateError } = await supabase
        .from('gift_cards')
        .update({
          status: 'active',
          mp_payment_id: String(paymentId),
          expiration_date: expirationDate.toISOString(),
        })
        .eq('id', giftCardId)
        .select('id, code, amount_ars, sender_name, sender_email, recipient_name, dedication, delivery_method')
        .single();

      if (updateError) {
        console.error('[Webhook/MP] Error activating gift card:', giftCardId, updateError);
      } else if (card) {
        // If delivery_method === 'fisica', create an event-driven task in staff_tasks for Ceci
        if (card.delivery_method === 'fisica') {
          try {
            // Find Ceci's profile ID or default staff operative
            const { data: ceciProfile } = await supabase
              .from('profiles')
              .select('id')
              .or('full_name.ilike.%Ceci%,role.eq.operativo')
              .limit(1)
              .maybeSingle();

            if (ceciProfile) {
              const todayAR = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Argentina/Buenos_Aires',
              }).format(new Date());

              await supabase.from('staff_tasks').insert({
                assigned_profile_id: ceciProfile.id,
                task_type: 'gift_card',
                title: `Preparar Gift Card Física: ${card.code}`,
                description: `Preparar tarjeta física para ${card.recipient_name || 'Agasajado/a'} (De parte de: ${card.sender_name}).`,
                due_date: todayAR,
                related_entity_type: 'gift_card',
                related_entity_id: card.id,
                status: 'pendiente',
              });
            }
          } catch (taskErr) {
            console.error('[Webhook/MP] Error creating physical gift card staff task:', taskErr);
          }
        }

        const formatARS = (n: number) =>
          new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

        console.log('[GiftCard/Dispatch Email → sender]', {
          to: card.sender_email,
          subject: 'Tu Gift Card está lista — Dra. Landaburo',
          code: card.code,
          amount: formatARS(card.amount_ars),
          recipient: card.recipient_name || 'Agasajado/a',
          dedication: card.dedication,
          delivery_method: card.delivery_method,
          expiration: expirationDate.toLocaleDateString('es-AR'),
        });
      }
    } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      await supabase
        .from('gift_cards')
        .update({ status: 'cancelled', mp_payment_id: String(paymentId) })
        .eq('id', giftCardId);
    }

    return NextResponse.json({ ok: true });
  }

  // ----- REGULAR ORDER FLOW -----
  const newStatus = MP_STATUS_MAP[mpStatus] ?? 'pending';

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
  }

  return NextResponse.json({ ok: true });
}
