/**
 * Webhook de MercadoPago — actualiza el estado de pago de la orden O de la gift card.
 * MP envía notificaciones con topic=payment cuando el estado cambia.
 * Verificamos la firma HMAC-SHA256 usando MP_WEBHOOK_SECRET.
 * Identificamos gift cards por external_reference que comienza con "giftcard:"
 *
 * ============================================================================
 * PROTOCOLO OBLIGATORIO DE ACTIVACIÓN DE MERCADO PAGO EN PRODUCCIÓN:
 * Antes de configurar MP_WEBHOOK_SECRET en producción, DEBE completarse el
 * siguiente protocolo de verificación en entorno de prueba (staging / local):
 * 1. Configurar MP_WEBHOOK_SECRET en el entorno de prueba.
 * 2. Mandar una request con firma HMAC válida y timestamp vigente -> Debe responder HTTP 200.
 * 3. Mandar una request con firma inválida -> Debe responder HTTP 401 (Unauthorized).
 * 4. Mandar una request con firma válida pero timestamp viejo (> 5 min) -> Rechazo por ventana temporal (HTTP 401).
 * ============================================================================
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createHmac } from 'crypto';
import { registerStockMovement } from '@/lib/stock/registerMovement';

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
  secret: string,
  toleranceSeconds: number = 300 // 5 minutos de ventana máxima
): { valid: boolean; reason?: string } {
  if (!signature || !secret) return { valid: false, reason: 'missing_signature_or_secret' };

  // x-signature format: ts=...,v1=...
  const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return { valid: false, reason: 'invalid_header_format' };

  // Ventana temporal: rechazar timestamps con desfase mayor a toleranceSeconds (replay attack defense)
  const tsNumber = Number(ts);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (isNaN(tsNumber) || Math.abs(nowSeconds - tsNumber) > toleranceSeconds) {
    return { valid: false, reason: 'timestamp_expired' };
  }

  // Manifest template: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const computedHash = createHmac('sha256', secret).update(manifest).digest('hex');

  const matches = computedHash.toLowerCase() === v1.toLowerCase();
  return { valid: matches, reason: matches ? undefined : 'hmac_mismatch' };
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

  // 1. Leer credenciales desde variables de entorno (sin tocar app_settings)
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  const mpAccessToken = process.env.MP_ACCESS_TOKEN;

  if (!webhookSecret) {
    console.error('[Webhook/MP] RECHAZADO: MP_WEBHOOK_SECRET no está configurado en las variables de entorno.');
    return NextResponse.json(
      { error: 'Servicio no configurado para recibir webhooks de pago.' },
      { status: 503 }
    );
  }

  // 2. Extracción de identificador para manifiesto (query param data.id o body id)
  const searchParams = req.nextUrl.searchParams;
  const manifestId = searchParams.get('data.id') || searchParams.get('id') || paymentId;
  const requestId = req.headers.get('x-request-id') ?? '';
  const signature = req.headers.get('x-signature');

  // 3. CAPA 1: Validación estricta y obligatoria de la firma HMAC-SHA256 con ventana temporal
  const { valid: isValid, reason: rejectReason } = verifySignature(manifestId, requestId, signature, webhookSecret);
  if (!isValid) {
    console.warn('[Webhook/MP] RECHAZADO 401: Intento de webhook con firma inválida o ausente.', {
      manifestId,
      requestId,
      reason: rejectReason,
      hasSignature: Boolean(signature),
      clientIp: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'desconocida',
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({
      error: 'Firma de webhook inválida o timestamp fuera de ventana permitida.',
      code: rejectReason
    }, { status: 401 });
  }

  // 4. CAPA 2: Re-consulta directa a la API oficial de Mercado Pago para verificar estado real
  if (!mpAccessToken) {
    console.error('[Webhook/MP] RECHAZADO: MP_ACCESS_TOKEN no configurado en servidor.');
    return NextResponse.json({ error: 'Configuración incompleta en servidor.' }, { status: 503 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // Consult MP for the actual payment data
  let mpPayment: Record<string, unknown>;
  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
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
      expirationDate.setDate(expirationDate.getDate() + 90);

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

  // Si la orden pasa a 'paid', descontar stock de los productos con tipo 'venta_online'
  if (newStatus === 'paid') {
    try {
      const { data: orderItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', externalRef);

      if (itemsErr) {
        console.error('[Webhook/MP] Error obteniendo items de la orden para descontar stock:', externalRef, itemsErr);
      } else if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          if (item.product_id && item.quantity > 0) {
            const movementRes = await registerStockMovement({
              productId: item.product_id,
              type: 'venta_online',
              delta: item.quantity,
              referenceType: 'order',
              referenceId: externalRef,
              notes: `Venta online orden #${externalRef.slice(0, 8)}`,
            });

            if (!movementRes.ok) {
              console.error(`[Webhook/MP] Error registrando venta_online para producto ${item.product_id}:`, movementRes.error);
            }
          }
        }
      }
    } catch (stockErr) {
      console.error('[Webhook/MP] Error inesperado descontando stock:', stockErr);
    }
  }

  return NextResponse.json({ ok: true });
}
