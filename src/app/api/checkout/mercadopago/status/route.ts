import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isConfigured = Boolean(
    process.env.MP_ACCESS_TOKEN && process.env.MP_ACCESS_TOKEN.trim().length > 0
  );

  let checkoutEnabled = false;
  let shippingEnabled = false;
  let shippingCostArs = 0;
  let pickupAddress = 'Leandro N. Alem 45, Gualeguaychú, Entre Ríos';
  let pickupHours = 'Lunes a Viernes de 9:00 a 17:00 hs';

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: config } = await supabase
      .from('store_config')
      .select('checkout_enabled, shipping_enabled, shipping_cost_ars, pickup_address, pickup_hours')
      .eq('id', 1)
      .maybeSingle();

    if (config) {
      checkoutEnabled = Boolean(config.checkout_enabled);
      shippingEnabled = Boolean(config.shipping_enabled);
      shippingCostArs = Number(config.shipping_cost_ars ?? 0);
      if (config.pickup_address) pickupAddress = config.pickup_address;
      if (config.pickup_hours) pickupHours = config.pickup_hours;
    }
  } catch (err) {
    console.error('[Status/MP] Error leyendo store_config:', err);
  }

  return NextResponse.json({
    isConfigured,
    checkoutEnabled,
    shippingEnabled,
    shippingCostArs,
    pickupAddress,
    pickupHours,
  });
}
