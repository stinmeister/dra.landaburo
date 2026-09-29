/**
 * Webhook de MercadoPago — actualiza el estado de pago de la orden O de la gift card.
 * MP envía notificaciones con topic=payment cuando el estado cambia.
 * Verificamos la firma HMAC-SHA256 usando MP_WEBHOOK_SECRET.
 * Identificamos gift cards por external_reference que comienza con "giftcard:"
 *
 * ============================================================================
 * PROTOCOLO DE MERCADO PAGO:
 * 1. Firma HMAC-SHA256 comparada en tiempo constante (timingSafeEqual).
 * 2. Ventana de tolerancia temporal: 300 segundos (replay attack defense).
 * 3. Si no valida firma o falta x-signature -> HTTP 401.
 * 4. Si valida -> Respuesta HTTP 200 INMEDIATA a Mercado Pago, desacoplando
 *    el procesamiento del pago y descuento de stock en segundo plano (after()).
 * 5. Idempotencia garantizada por paymentId y reference_id en stock_movements.
 * ============================================================================
 */
import { NextRequest, NextResponse, after } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createHmac, timingSafeEqual } from 'crypto';
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

  // Manifest template oficial: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const computedHash = createHmac('sha256', secret).update(manifest).digest('hex');

  // Comparación en tiempo constante (timing safe)
  try {
    const computedBuf = Buffer.from(computedHash, 'hex');
    const receivedBuf = Buffer.from(v1, 'hex');
    if (computedBuf.length !== receivedBuf.length || !timingSafeEqual(computedBuf, receivedBuf)) {
      return { valid: false, reason: 'hmac_mismatch' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'hmac_mismatch' };
  }
}

/**
 * Procesa el pago de Mercado Pago en segundo plano de forma asíncrona.
 * Ejecutado tras enviar HTTP 200 para evitar reintentos y timeouts.
 */
async function processPaymentNotification(paymentId: string, mpAccessToken: string) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // 1. Consultar estado real del pago en la API de Mercado Pago
  let mpPayment: Record<string, unknown>;
  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });
    if (!mpRes.ok) {
      console.error('[Webhook/MP Async] Error al consultar pago en MP API:', mpRes.status);
      return;
    }
    mpPayment = await mpRes.json();
  } catch (err) {
    console.error('[Webhook/MP Async] Error de red consultando MP:', err);
    return;
  }

  const mpStatus = mpPayment.status as string | undefined;
  const externalRef = mpPayment.external_reference as string | undefined;

  if (!externalRef || !mpStatus) {
    console.warn('[Webhook/MP Async] Pago sin external_reference o status:', paymentId);
    return;
  }

  // 2. Flujo de Gift Cards
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
        console.error('[Webhook/MP Async] Error activando gift card:', giftCardId, updateError);
      } else if (card && card.delivery_method === 'fisica') {
        try {
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
          console.error('[Webhook/MP Async] Error creando tarea en staff_tasks:', taskErr);
        }
      }
    } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      await supabase
        .from('gift_cards')
        .update({ status: 'cancelled', mp_payment_id: String(paymentId) })
        .eq('id', giftCardId);
    }
    return;
  }

  // 3. Flujo de Órdenes Regulares
  const newStatus = MP_STATUS_MAP[mpStatus] ?? 'pending';

  // Idempotencia: verificar si la orden ya está pagada con este mismo payment_id
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id, payment_status, mp_payment_id')
    .eq('id', externalRef)
    .maybeSingle();

  if (existingOrder && existingOrder.payment_status === 'paid' && existingOrder.mp_payment_id === String(paymentId)) {
    console.log(`[Webhook/MP Async] Orden #${externalRef} ya procesada como 'paid' para pago #${paymentId}. Omitiendo duplicado.`);
    return;
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_status: newStatus,
      mp_payment_id: String(paymentId),
      updated_at: new Date().toISOString(),
    })
    .eq('id', externalRef);

  if (updateError) {
    console.error('[Webhook/MP Async] Error actualizando orden:', externalRef, updateError);
  }

  // Si la orden pasa a 'paid', descontar stock de los productos con tipo 'venta_online'
  if (newStatus === 'paid') {
    try {
      const { data: orderItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', externalRef);

      if (itemsErr) {
        console.error('[Webhook/MP Async] Error obteniendo items de la orden:', externalRef, itemsErr);
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
              console.error(`[Webhook/MP Async] Error registrando venta_online para producto ${item.product_id}:`, movementRes.error);
            }
          }
        }
      }
    } catch (stockErr) {
      console.error('[Webhook/MP Async] Error inesperado descontando stock:', stockErr);
    }
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let notification: Record<string, unknown>;
  try {
    notification = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  // 1. Extraer y loguear live_mode explícitamente en cada notificación (2.1 a)
  const liveMode = typeof notification.live_mode === 'boolean' ? notification.live_mode : null;
  const rawPaymentId = (notification.data as Record<string, unknown>)?.id ?? notification.id;
  const paymentId = rawPaymentId ? String(rawPaymentId) : null;

  console.log('[Webhook/MP] Notificación recibida:', {
    live_mode: liveMode,
    environment: liveMode === true ? 'PRODUCCIÓN' : liveMode === false ? 'TEST/SANDBOX' : 'NO_ESPECIFICADO',
    topic: notification.topic || notification.type,
    action: notification.action,
    id: paymentId,
    timestamp: new Date().toISOString(),
  });

  // Topics de Checkout Pro: atender payment; responder 200 en merchant_order u otros
  if (notification.topic !== 'payment' && notification.type !== 'payment') {
    return NextResponse.json({ ok: true });
  }

  if (!paymentId) {
    return NextResponse.json({ error: 'payment_id faltante.' }, { status: 400 });
  }

  // 2. Leer credenciales desde variables de entorno
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  const mpAccessToken = process.env.MP_ACCESS_TOKEN;

  if (!webhookSecret) {
    console.error('[Webhook/MP] RECHAZADO: MP_WEBHOOK_SECRET no está configurado en las variables de entorno.');
    return NextResponse.json(
      { error: 'Servicio no configurado para recibir webhooks de pago.' },
      { status: 503 }
    );
  }

  // 3. Extracción de identificador para manifiesto (query param data.id o body id)
  const searchParams = req.nextUrl.searchParams;
  const manifestId = searchParams.get('data.id') || searchParams.get('id') || paymentId;
  const requestId = req.headers.get('x-request-id') ?? '';
  const signature = req.headers.get('x-signature');

  // 4. Validación estricta de la firma HMAC-SHA256 con ventana temporal y timingSafeEqual
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
      code: rejectReason,
    }, { status: 401 });
  }

  // 5. VALIDACIÓN OK -> Responder HTTP 200 INMEDIATO a Mercado Pago (2.1 c)
  // Desacoplamos la consulta a la API de MP y descuento de stock en segundo plano
  if (!mpAccessToken) {
    console.error('[Webhook/MP] Advertencia: MP_ACCESS_TOKEN no configurado en servidor; no se puede procesar pago.');
    return NextResponse.json({ ok: true, warning: 'token_missing' });
  }

  after(async () => {
    try {
      await processPaymentNotification(paymentId, mpAccessToken);
    } catch (bgError) {
      console.error('[Webhook/MP Async] Error no controlado en procesamiento de fondo:', bgError);
    }
  });

  return NextResponse.json({ ok: true });
}
