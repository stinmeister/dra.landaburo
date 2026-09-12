// POST /api/gift-cards/checkout
// Creates a MercadoPago preference for a multi-item or single-item gift card purchase.
// Supports combinations of treatments, skincare products, and custom ARS amount.
// Prices and amounts are strictly verified server-side against Supabase DB.
// Generates unique code DL-XXXX-XXXX server-side.
// Supports delivery_method: 'digital' | 'fisica'.
// Sets expiration to 90 days.

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

interface IncomingItem {
  item_type?: 'treatment' | 'product' | 'custom_amount';
  treatment_id?: string | null;
  product_id?: string | null;
  custom_amount_ars?: number | null;
  unit_price_ars?: number | null;
  quantity?: number;
  title?: string;
}

interface ValidatedItem {
  item_type: 'treatment' | 'product' | 'custom_amount';
  treatment_id: string | null;
  product_id: string | null;
  custom_amount_ars: number | null;
  unit_price: number;
  quantity: number;
  title: string;
}

export async function POST(req: NextRequest) {
  let body: {
    items?: IncomingItem[];
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
    items: rawItems,
    treatment_id,
    product_id,
    sender_name,
    sender_email,
    recipient_name,
    dedication,
    delivery_method = 'digital',
  } = body;

  // Build items list (supporting new multi-item cart & legacy single item)
  let incomingItems: IncomingItem[] = [];
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    incomingItems = rawItems;
  } else if (treatment_id) {
    incomingItems = [{ item_type: 'treatment', treatment_id, quantity: 1 }];
  } else if (product_id) {
    incomingItems = [{ item_type: 'product', product_id, quantity: 1 }];
  } else {
    return NextResponse.json(
      { error: 'Debes seleccionar al menos un tratamiento, producto o saldo libre.' },
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

  // Security: verify price in DB for every item
  const treatmentIds = incomingItems
    .filter((i) => i.item_type === 'treatment' || i.treatment_id)
    .map((i) => i.treatment_id!)
    .filter(Boolean);

  const productIds = incomingItems
    .filter((i) => i.item_type === 'product' || i.product_id)
    .map((i) => i.product_id!)
    .filter(Boolean);

  // Fetch treatments if needed
  const treatmentsMap = new Map<string, { title: string; price_ars: number }>();
  if (treatmentIds.length > 0) {
    const { data: dbTreatments, error: tErr } = await supabase
      .from('treatments')
      .select('id, title, price_ars')
      .in('id', treatmentIds);

    if (tErr) {
      console.error('[GiftCard/Checkout] Error querying treatments:', tErr);
      return NextResponse.json({ error: 'Error al verificar tratamientos.' }, { status: 500 });
    }
    dbTreatments?.forEach((t) => {
      if (t.price_ars) treatmentsMap.set(t.id, { title: t.title, price_ars: Number(t.price_ars) });
    });
  }

  // Fetch products if needed
  const productsMap = new Map<string, { name: string; price_ars: number }>();
  if (productIds.length > 0) {
    const { data: dbProducts, error: pErr } = await supabase
      .from('products')
      .select('id, name, price_ars')
      .in('id', productIds);

    if (pErr) {
      console.error('[GiftCard/Checkout] Error querying products:', pErr);
      return NextResponse.json({ error: 'Error al verificar productos.' }, { status: 500 });
    }
    dbProducts?.forEach((p) => {
      if (p.price_ars) productsMap.set(p.id, { name: p.name, price_ars: Number(p.price_ars) });
    });
  }

  const validatedItems: ValidatedItem[] = [];

  for (const item of incomingItems) {
    const qty = Math.max(1, Math.floor(item.quantity || 1));

    if (item.item_type === 'treatment' || item.treatment_id) {
      const tId = item.treatment_id!;
      const dbT = treatmentsMap.get(tId);
      if (!dbT || !dbT.price_ars || dbT.price_ars <= 0) {
        return NextResponse.json({ error: 'Uno de los tratamientos no tiene un precio válido.' }, { status: 400 });
      }
      validatedItems.push({
        item_type: 'treatment',
        treatment_id: tId,
        product_id: null,
        custom_amount_ars: null,
        unit_price: dbT.price_ars,
        quantity: qty,
        title: dbT.title,
      });
    } else if (item.item_type === 'product' || item.product_id) {
      const pId = item.product_id!;
      const dbP = productsMap.get(pId);
      if (!dbP || !dbP.price_ars || dbP.price_ars <= 0) {
        return NextResponse.json({ error: 'Uno de los productos no tiene un precio válido.' }, { status: 400 });
      }
      validatedItems.push({
        item_type: 'product',
        treatment_id: null,
        product_id: pId,
        custom_amount_ars: null,
        unit_price: dbP.price_ars,
        quantity: qty,
        title: dbP.name,
      });
    } else if (item.item_type === 'custom_amount' || item.custom_amount_ars) {
      const amount = Number(item.custom_amount_ars);
      if (isNaN(amount) || amount < 10000) {
        return NextResponse.json({ error: 'El monto libre mínimo es de $ 10.000 ARS.' }, { status: 400 });
      }
      validatedItems.push({
        item_type: 'custom_amount',
        treatment_id: null,
        product_id: null,
        custom_amount_ars: amount,
        unit_price: amount,
        quantity: 1,
        title: item.title || `Saldo a elección en consultorio`,
      });
    }
  }

  if (validatedItems.length === 0) {
    return NextResponse.json({ error: 'No se pudieron validar los ítems de la Gift Card.' }, { status: 400 });
  }

  const totalAmountARS = validatedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  // Leer credencial de Mercado Pago desde variable de entorno
  const mpAccessToken = process.env.MP_ACCESS_TOKEN;

  if (!mpAccessToken) {
    console.warn('[GiftCard/Checkout] MP_ACCESS_TOKEN no configurado en variables de entorno.');
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

  // Vigencia de 90 días corridos
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 90);

  const { data: giftCard, error: insertError } = await supabase
    .from('gift_cards')
    .insert({
      code,
      amount_ars: totalAmountARS,
      remaining_balance_ars: totalAmountARS,
      treatment_id: validatedItems.length === 1 && validatedItems[0].treatment_id ? validatedItems[0].treatment_id : null,
      product_id: validatedItems.length === 1 && validatedItems[0].product_id ? validatedItems[0].product_id : null,
      delivery_method: delivery_method === 'fisica' ? 'fisica' : 'digital',
      status: 'pending_payment',
      expiration_date: expirationDate.toISOString(),
      sender_name: sender_name.trim(),
      sender_email: sender_email.trim().toLowerCase(),
      recipient_name: recipient_name?.trim() || null,
      dedication: dedication?.trim() || null,
    })
    .select('id, code')
    .single();

  if (insertError || !giftCard) {
    console.error('[GiftCard/Checkout] Insert error into gift_cards:', insertError);
    return NextResponse.json({ error: 'Error interno al crear gift card.' }, { status: 500 });
  }

  // Save items in gift_card_items table if table exists
  try {
    const itemsPayload = validatedItems.map((item) => ({
      gift_card_id: giftCard.id,
      item_type: item.item_type,
      treatment_id: item.treatment_id,
      product_id: item.product_id,
      custom_amount_ars: item.custom_amount_ars,
      unit_price_ars: item.unit_price,
      quantity: item.quantity,
      subtotal_ars: item.unit_price * item.quantity,
      item_title: item.title,
    }));

    await supabase.from('gift_card_items').insert(itemsPayload);
  } catch (itemsErr) {
    console.warn('[GiftCard/Checkout] Warning inserting gift_card_items (table might be pending SQL migration):', itemsErr);
  }

  // Create MercadoPago preference
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const mpItems = validatedItems.map((item, idx) => ({
    id: `${giftCard.id}_${idx + 1}`,
    title: `Gift Card — ${item.title}`,
    quantity: item.quantity,
    unit_price: item.unit_price,
    currency_id: 'ARS',
  }));

  const mpBody = {
    items: mpItems,
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
        Authorization: `Bearer ${mpAccessToken}`,
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
