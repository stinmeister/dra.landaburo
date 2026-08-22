// Route handler de checkout con MercadoPago.
// Lee mp_access_token de la tabla app_settings (admin-only en Supabase).
// Crea la orden en Supabase y luego llama a la API de MP para obtener init_point.
// Se usa el service role key para escribir la orden porque el usuario puede ser anónimo.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface CartItemPayload {
  id: string;
  slug: string;
  name: string;
  price_ars: number;
  image_url: string | null;
  quantity: number;
}

interface BuyerPayload {
  name: string;
  email: string;
  phone: string;
}

interface CheckoutBody {
  items: CartItemPayload[];
  buyer: BuyerPayload;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const { items, buyer } = body;

  // Validaciones básicas
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'El carrito está vacío.' }, { status: 400 });
  }
  if (!buyer?.name?.trim() || !buyer?.email?.trim()) {
    return NextResponse.json({ error: 'Nombre y email son obligatorios.' }, { status: 400 });
  }
  if (!isValidEmail(buyer.email)) {
    return NextResponse.json({ error: 'El email ingresado no es válido.' }, { status: 400 });
  }

  // Cliente Supabase con service role para escribir órdenes de usuarios anónimos.
  // No exponemos el service role key al cliente — esta ruta es server-side.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // service role no necesita persistir cookies de auth
      },
    }
  );

  // SEGURIDAD: nunca confiar en el precio enviado por el cliente.
  // Buscamos el precio real de cada producto directamente en la BD.
  const productIds = items.map((i) => i.id);
  const { data: dbProducts, error: productsError } = await supabase
    .from('products')
    .select('id, price_ars')
    .in('id', productIds);

  if (productsError || !dbProducts || dbProducts.length !== productIds.length) {
    console.error('[Checkout/MP] No se pudieron verificar precios de productos:', productsError);
    return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 400 });
  }

  // Construimos un mapa id → price_ars para acceso O(1) al armar los items
  const priceMap = new Map<string, number>(dbProducts.map((p) => [p.id, p.price_ars]));

  // Leer configuración de MercadoPago desde app_settings
  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('mp_access_token')
    .single();

  if (settingsError || !settings?.mp_access_token) {
    console.error('[Checkout/MP] No se encontró mp_access_token en app_settings:', settingsError);
    return NextResponse.json(
      { error: 'El sistema de pagos no está configurado. Contactá al consultorio.' },
      { status: 503 }
    );
  }

  // Calcular total usando precios de la BD, no del cliente
  const totalARS = items.reduce((sum, i) => sum + priceMap.get(i.id)! * i.quantity, 0);

  // Crear orden en Supabase
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_name: buyer.name.trim(),
      buyer_email: buyer.email.trim().toLowerCase(),
      buyer_phone: buyer.phone?.trim() || null,
      total_ars: totalARS,
      payment_status: 'pending',
      payment_method: 'mercadopago',
    })
    .select('id')
    .single();

  if (orderError || !order) {
    console.error('[Checkout/MP] Error creando orden:', orderError);
    return NextResponse.json({ error: 'Error interno. Intentá de nuevo.' }, { status: 500 });
  }

  // Insertar items de la orden
  const orderItems = items.map((i) => {
    const unitPrice = priceMap.get(i.id)!;
    return {
      order_id: order.id,
      product_id: i.id,
      product_name: i.name,
      quantity: i.quantity,
      unit_price_ars: unitPrice,
      subtotal_ars: unitPrice * i.quantity,
    };
  });

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) {
    console.error('[Checkout/MP] Error insertando order_items:', itemsError);
    // No cancelamos la orden — MP puede confirmarla igual; se concilia manualmente
  }

  // Llamar a MercadoPago Preferences API
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const mpBody = {
    items: items.map((i) => ({
      id: i.id,
      title: i.name,
      quantity: i.quantity,
      unit_price: priceMap.get(i.id)!, // precio verificado desde la BD
      currency_id: 'ARS',
    })),
    payer: {
      name: buyer.name.trim(),
      email: buyer.email.trim().toLowerCase(),
      ...(buyer.phone?.trim() ? { phone: { number: buyer.phone.trim() } } : {}),
    },
    external_reference: order.id,
    back_urls: {
      success: `${siteUrl}/tienda/pago/exito?order_id=${order.id}`,
      pending: `${siteUrl}/tienda/pago/pendiente?order_id=${order.id}`,
      failure: `${siteUrl}/tienda/pago/fallo?order_id=${order.id}`,
    },
    auto_return: 'approved',
    notification_url: `${siteUrl}/api/webhook/mercadopago`,
    statement_descriptor: 'DRA LANDABURO',
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
    console.error('[Checkout/MP] Error de red al llamar MP:', fetchErr);
    return NextResponse.json(
      { error: 'No se pudo conectar con MercadoPago. Intentá de nuevo.' },
      { status: 502 }
    );
  }

  if (!mpResponse.ok) {
    const mpError = await mpResponse.text().catch(() => 'sin detalle');
    console.error('[Checkout/MP] MP respondió con error:', mpResponse.status, mpError);
    return NextResponse.json(
      { error: 'Error al crear la preferencia de pago. Intentá de nuevo.' },
      { status: 502 }
    );
  }

  const mpData = await mpResponse.json();
  return NextResponse.json({ init_point: mpData.init_point });
}
