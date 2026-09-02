// POST /api/gift-cards/checkout
// Creates a MercadoPago preference for a gift card purchase.
// Supports specific treatment OR specific product (never arbitrary amount).
// Price is verified server-side against Supabase DB.
// Generates unique code DL-XXXX-XXXX server-side.
// Supports delivery_method: 'digital' | 'fisica'.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, no 1/I

function generateCode(): string {
  const rand = (len: number) =>
    Array.from({ length: len }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  return `DL-${rand(4)}-${rand(4)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: {
    treatment_id?: string | null;
    product_id?: string | null;
    sender_name: string;
    sender_email: string;
    recipient_name?: string | null;
    dedication?: string | null;
    delivery_method?: 'digital' | 'fisica';
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const {
    treatment_id,
    product_id,
    sender_name,
    sender_email,
    recipient_name,
    dedication,
    delivery_method = 'digital',
  } = body;

  // Validate exactly one item type
  if ((!treatment_id && !product_id) || (treatment_id && product_id)) {
    return NextResponse.json(
      { error: 'Debes seleccionar exactamente un tratamiento o un producto.' },
      { status: 400 }
    );
  }

  if (!sender_name?.trim()) {
    return NextResponse.json({ error: 'El nombre del remitente es obligatorio.' }, { status: 400 });
  }
  if (!sender_email?.trim() || !isValidEmail(sender_email.trim())) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // Security: verify price in DB
  let itemName = '';
  let itemPrice = 0;

  if (treatment_id) {
    const { data: treatment, error: tErr } = await supabase
      .from('treatments')
      .select('name, price_ars')
      .eq('id', treatment_id)
      .single();

    if (tErr || !treatment || !treatment.price_ars) {
      return NextResponse.json({ error: 'Tratamiento no encontrado o sin precio.' }, { status: 404 });
    }
    itemName = `Tratamiento: ${treatment.name}`;
    itemPrice = treatment.price_ars;
  } else if (product_id) {
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('name, price_ars')
      .eq('id', product_id)
      .single();

    if (pErr || !product || !product.price_ars) {
      return NextResponse.json({ error: 'Producto no encontrado o sin precio.' }, { status: 404 });
    }
    itemName = `Producto: ${product.name}`;
    itemPrice = product.price_ars;
  }

  if (itemPrice <= 0) {
    return NextResponse.json({ error: 'Precio del item no válido.' }, { status: 400 });
  }

  // Read MP access token from app_settings
  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('mp_access_token')
    .single();

  if (settingsError || !settings?.mp_access_token) {
    console.error('[GiftCard/Checkout] mp_access_token not found:', settingsError);
    return NextResponse.json(
      { error: 'El sistema de pagos no está configurado. Contactá al consultorio.' },
      { status: 503 }
    );
  }

  // Generate unique code with retry on collision
  let code: string = '';
  let attempts = 0;
  while (attempts < 10) {
    const candidate = generateCode();
    const { data: existing } = await supabase
      .from('gift_cards')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();
    if (!existing) {
      code = candidate;
      break;
    }
    attempts++;
  }
  if (!code) {
    console.error('[GiftCard/Checkout] Failed to generate unique code after 10 attempts');
    return NextResponse.json({ error: 'Error generando código. Intentá de nuevo.' }, { status: 500 });
  }

  // Set placeholder expiry (1 year out, will be recalculated to +180 days upon webhook approval)
  const placeholderExpiry = new Date();
  placeholderExpiry.setFullYear(placeholderExpiry.getFullYear() + 1);

  const { data: giftCard, error: insertError } = await supabase
    .from('gift_cards')
    .insert({
      code,
      amount_ars: itemPrice,
      remaining_balance_ars: itemPrice,
      treatment_id: treatment_id || null,
      product_id: product_id || null,
      delivery_method: delivery_method === 'fisica' ? 'fisica' : 'digital',
      status: 'pending_payment',
      expiration_date: placeholderExpiry.toISOString(),
      sender_name: sender_name.trim(),
      sender_email: sender_email.trim().toLowerCase(),
      recipient_name: recipient_name?.trim() || null,
      dedication: dedication?.trim() || null,
    })
    .select('id, code')
    .single();

  if (insertError || !giftCard) {
    console.error('[GiftCard/Checkout] Insert error:', insertError);
    return NextResponse.json({ error: 'Error interno al crear gift card.' }, { status: 500 });
  }

  // Create MercadoPago preference
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const mpBody = {
    items: [
      {
        id: giftCard.id,
        title: `Gift Card — ${itemName}`,
        quantity: 1,
        unit_price: itemPrice,
        currency_id: 'ARS',
      },
    ],
    payer: {
      name: sender_name.trim(),
      email: sender_email.trim().toLowerCase(),
    },
    external_reference: `giftcard:${giftCard.id}`,
    back_urls: {
      success: `${siteUrl}/tienda/pago/exito?gift_card=${giftCard.id}`,
      pending: `${siteUrl}/tienda/pago/pendiente?gift_card=${giftCard.id}`,
      failure: `${siteUrl}/tienda/pago/fallo?gift_card=${giftCard.id}`,
    },
    auto_return: 'approved',
    notification_url: `${siteUrl}/api/webhook/mercadopago`,
    statement_descriptor: 'DRA LANDABURO GIFT',
  };

  let mpResponse: Response;
  try {
    mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.mp_access_token}`,
      },
      body: JSON.stringify(mpBody),
    });
  } catch (fetchErr) {
    console.error('[GiftCard/Checkout] Network error calling MP:', fetchErr);
    return NextResponse.json({ error: 'No se pudo conectar con MercadoPago.' }, { status: 502 });
  }

  if (!mpResponse.ok) {
    const mpErr = await mpResponse.text().catch(() => 'sin detalle');
    console.error('[GiftCard/Checkout] MP error:', mpResponse.status, mpErr);
    return NextResponse.json({ error: 'Error al crear el pago en MercadoPago.' }, { status: 502 });
  }

  const mpData = await mpResponse.json();
  return NextResponse.json({ init_point: mpData.init_point });
}
