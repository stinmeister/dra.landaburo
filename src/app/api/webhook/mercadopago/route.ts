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
import { sendOrderEmails } from '@/lib/email/orderEmails';

const MP_STATUS_MAP: Record<string, string> = {
  approved: 'approved',
  pending: 'pending',
  in_process: 'pending',
  rejected: 'rejected',
  cancelled: 'rejected',
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
      if (mpRes.status === 404) {
        console.warn(`[Webhook/MP Async] Pago #${paymentId} no encontrado en la API de Mercado Pago (404 Not Found). Simulación del panel o ID inexistente. Ignorado de forma segura sin reintentos.`);
      } else {
        console.error('[Webhook/MP Async] Error al consultar pago en MP API:', mpRes.status);
      }
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
      // Idempotencia: verificar si la gift card ya está activa con este pago
      const { data: existingCard } = await supabase
        .from('gift_cards')
        .select('id, status, mp_payment_id')
        .eq('id', giftCardId)
        .maybeSingle();

      if (existingCard && existingCard.status === 'active' && existingCard.mp_payment_id === String(paymentId)) {
        console.log(`[Webhook/MP Async] Gift Card #${giftCardId} ya procesada como 'active' para pago #${paymentId}. Omitiendo duplicado.`);
        return;
      }

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

  if (
    existingOrder &&
    (existingOrder.payment_status === 'approved' || existingOrder.payment_status === 'paid') &&
    existingOrder.mp_payment_id === String(paymentId)
  ) {
    console.log(`[Webhook/MP Async] Orden #${externalRef} ya procesada como 'approved' para pago #${paymentId}. Omitiendo duplicado.`);
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

  // Si la orden pasa a 'approved', descontar stock, crear tarea operativa y despachar emails
  if (newStatus === 'approved' || newStatus === 'paid') {
    try {
      const { data: orderItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('product_id, quantity, unit_price_ars, products(name)')
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

      // Obtener datos completos de la orden para tarea y emails
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', externalRef)
        .maybeSingle();

      if (orderErr || !orderData) {
        console.error('[Webhook/MP Async] Error obteniendo datos de orden para tareas/emails:', orderErr);
      } else {
        const orderNum = orderData.order_number || `ORD-${externalRef.slice(0, 8)}`;
        const buyerName = orderData.buyer_name || orderData.customer_name || 'Compradora';
        const methodDesc = orderData.delivery_method === 'envio' ? 'Envío a domicilio' : 'Retiro en consultorio';

        // 1. Crear tarea en staff_tasks para el equipo operativo (4.5)
        try {
          const todayAR = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Argentina/Buenos_Aires',
          }).format(new Date());

          await supabase.from('staff_tasks').insert({
            target_role: 'operativo',
            assigned_profile_id: null,
            task_type: 'recurrente',
            title: `Preparar pedido ${orderNum}`,
            description: `Pedido de ${buyerName}. Método: ${methodDesc}. Total: $${Number(orderData.total_ars).toLocaleString('es-AR')}.`,
            due_date: todayAR,
            status: 'pendiente',
          });
          console.log(`[Webhook/MP Async] Tarea creada para pedido ${orderNum} en staff_tasks`);
        } catch (taskErr) {
          console.error('[Webhook/MP Async] Error creando tarea en staff_tasks:', taskErr);
        }

        // 2. Consultar store_config para datos de entrega del consultorio
        let storeConfig = {
          pickup_address: 'Leandro N. Alem 45, Gualeguaychú, Entre Ríos',
          pickup_hours: 'Lunes a Viernes de 9:00 a 17:00 hs',
        };
        try {
          const { data: scData } = await supabase
            .from('store_config')
            .select('pickup_address, pickup_hours')
            .eq('id', 1)
            .maybeSingle();
          if (scData) {
            if (scData.pickup_address) storeConfig.pickup_address = scData.pickup_address;
            if (scData.pickup_hours) storeConfig.pickup_hours = scData.pickup_hours;
          }
        } catch (scErr) {
          console.error('[Webhook/MP Async] Error leyendo store_config:', scErr);
        }

        // 3. Despachar emails por Resend (compradora y consultorio)
        const itemsForEmail = (orderItems || []).map((fi: any) => ({
          product_name: fi.products?.name || 'Producto',
          quantity: fi.quantity,
          unit_price_ars: Number(fi.unit_price_ars || 0),
        }));

        const buyerEmail = orderData.buyer_email || orderData.customer_email;
        if (buyerEmail) {
          await sendOrderEmails({
            order: {
              id: orderData.id,
              order_number: orderNum,
              buyer_name: buyerName,
              buyer_email: buyerEmail,
              buyer_phone: orderData.buyer_phone || orderData.customer_phone || null,
              total_ars: Number(orderData.total_ars),
              delivery_method: orderData.delivery_method || 'retiro',
              delivery_address: orderData.delivery_address || null,
              delivery_city: orderData.delivery_city || null,
              delivery_postal_code: orderData.delivery_postal_code || null,
              delivery_notes: orderData.delivery_notes || null,
            },
            items: itemsForEmail,
            storeConfig,
          });
        }
      }
    } catch (stockErr) {
      console.error('[Webhook/MP Async] Error inesperado en procesamiento de orden pagada:', stockErr);
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

  // 1. Extraer y loguear live_mode informativamente en cada notificación.
  // NOTA ARQUITECTÓNICA: live_mode se utiliza únicamente con fines de auditoría.
  // El simulador oficial del panel de Mercado Pago envía `live_mode: false` incluso contra la URL de producción.
  // Por diseño explícito, este handler NUNCA bifurca bases de datos, tablas ni credenciales basándose en live_mode;
  // opera de forma consistente contra el entorno único de producción configurado en .env.local.
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

  // DECISIÓN ARQUITECTÓNICA DELIBERADA:
  // Checkout Pro dispara eventos tanto de 'payment' como de 'merchant_order' o 'test'.
  // Nuestra arquitectura procesa únicamente eventos 'payment' (que acreditan o rechazan cobros reales).
  // Los eventos ajenos a 'payment' no mutan la base de datos ni modifican stock.
  // Responder HTTP 200 inmediatamente a 'merchant_order' u otros evita que Mercado Pago inicie
  // una tormenta de reintentos con backoff durante 24 horas sobre eventos no requeridos.
  // Por diseño, el 503 por falta de MP_WEBHOOK_SECRET protege únicamente la ruta crítica de 'payment',
  // permitiendo que pings o eventos informativos sean absorbidos limpiamente sin generar falsas alertas.
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
    const reqId = req.headers.get('x-request-id') || 'desconocido';
    console.error(
      `[Webhook/MP] RECHAZADO 503: MP_WEBHOOK_SECRET no está configurado en las variables de entorno. data.id=${paymentId}, x-request-id=${reqId}`
    );
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
