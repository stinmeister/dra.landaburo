// POST /api/gift-cards/checkout
// Creates a MercadoPago preference for a multi-item or single-item gift card purchase.
// Supports combinations of treatments, skincare products, and custom ARS amount.
// Prices and amounts are strictly verified server-side against Supabase DB.
// Generates unique code DL-XXXX-XXXX server-side.
// Supports delivery_method: 'digital' | 'fisica'.
// Sets expiration to 90 days.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isRateLimited, getClientIp } from '@/lib/rateLimit';
import { buildGiftCardPreferenceBody } from '@/lib/mercadopago/preference';
import {
  resolveCheckoutSiteUrl,
  dispatchGiftCardPreferenceToMp,
  BUYER_SITE_URL_MISCONFIGURED_MESSAGE,
} from '@/lib/mercadopago/preferenceRuntime';

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
  const clientIp = getClientIp(req.headers);
  if (await isRateLimited(clientIp, 'checkout-giftcard', { windowMs: 60 * 1000, max: 10 })) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes de compra de gift cards. Por favor aguarde un momento.' },
      { status: 429 }
    );
  }

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

  // Leer credencial de Mercado Pago y URL pública antes de insertar en gift_cards
  const mpAccessToken = process.env.MP_ACCESS_TOKEN?.trim();

  if (!mpAccessToken) {
    console.warn('[GiftCard/Checkout] MP_ACCESS_TOKEN no configurado en variables de entorno.');
    return NextResponse.json(
      { error: BUYER_SITE_URL_MISCONFIGURED_MESSAGE },
      { status: 503 }
    );
  }

  const siteUrlResolved = resolveCheckoutSiteUrl(process.env);
  if (!siteUrlResolved.ok) {
    console.error(`[GiftCard/Checkout] Configuración inválida: ${siteUrlResolved.reason}`);
    return NextResponse.json(
      { error: BUYER_SITE_URL_MISCONFIGURED_MESSAGE },
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
    console.error('[GiftCard/Checkout] Insert error into gift_cards:', insertError?.message || 'sin detalle');
    return NextResponse.json(
      { error: BUYER_SITE_URL_MISCONFIGURED_MESSAGE },
      { status: 500 }
    );
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
  // Mitigación temporal de FIX-129: solo pagos instantáneos (binary_mode: true + exclusión de ticket y atm).
  const mpBody = buildGiftCardPreferenceBody({
    giftCardId: giftCard.id,
    siteUrl: siteUrlResolved.siteUrl,
    items: validatedItems.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unitPriceArs: item.unit_price,
    })),
    sender: {
      name: sender_name,
      email: sender_email,
    },
  });

  const dispatchResult = await dispatchGiftCardPreferenceToMp({
    giftCardId: giftCard.id,
    giftCardCode: giftCard.code,
    mpAccessToken,
    mpBody,
    markGiftCardCancelled: async (failedGiftCardId) => {
      const { error: cancelErr } = await supabase
        .from('gift_cards')
        .update({ status: 'cancelled' })
        .eq('id', failedGiftCardId);
      if (cancelErr) {
        console.error('[GiftCard/Checkout] Error marcando gift_card cancelada tras fallo de MP:', {
          giftCardId: failedGiftCardId,
          dbError: cancelErr.message,
        });
      }
    },
  });

  if (!dispatchResult.ok) {
    return NextResponse.json(
      {
        error: dispatchResult.error,
        code: dispatchResult.code,
        canRetry: dispatchResult.canRetry,
      },
      { status: dispatchResult.httpStatus }
    );
  }

  return NextResponse.json({ init_point: dispatchResult.initPoint });
}
