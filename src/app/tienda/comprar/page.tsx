import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { resolveCheckoutSiteUrl } from '@/lib/mercadopago/preferenceRuntime';
import FinalizarCompraClient, {
  type DirectCheckoutProduct,
  type CheckoutStoreConfig,
} from './FinalizarCompraClient';

export const metadata: Metadata = {
  title: 'Finalizá tu compra | Tienda',
  robots: { index: false, follow: false },
};

type SearchParams = {
  producto?: string;
  cantidad?: string;
};

export default async function FinalizarCompraPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { producto, cantidad } = await searchParams;
  const supabase = await createClient();

  const isDirect = Boolean(producto && producto.trim());
  const decodedSlug = isDirect ? decodeURIComponent(producto!.trim()) : null;

  const [storeConfigRes, directProductRes] = await Promise.all([
    supabase
      .from('store_config')
      .select('checkout_enabled, shipping_enabled, shipping_cost_ars, pickup_address, pickup_hours')
      .eq('id', 1)
      .maybeSingle(),
    decodedSlug
      ? supabase
          .from('products')
          .select('id, name, slug, price_ars, image_url, stock_quantity, is_active, is_public')
          .eq('slug', decodedSlug)
          .eq('is_active', true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const rawConfig = storeConfigRes.data;
  const isMpConfigured =
    Boolean(process.env.MP_ACCESS_TOKEN?.trim()) &&
    resolveCheckoutSiteUrl(process.env).ok;

  const storeConfig: CheckoutStoreConfig = {
    isConfigured: isMpConfigured,
    checkoutEnabled: rawConfig?.checkout_enabled ?? false,
    shippingEnabled: rawConfig?.shipping_enabled ?? false,
    shippingCostArs: Number(rawConfig?.shipping_cost_ars) || 0,
    pickupAddress:
      rawConfig?.pickup_address || 'Leandro N. Alem 45, Gualeguaychú, Entre Ríos',
    pickupHours: rawConfig?.pickup_hours || 'A coordinar por WhatsApp',
  };

  let directProduct: DirectCheckoutProduct | null = null;
  let directNotFound = false;

  if (isDirect) {
    const rawProd = directProductRes.data;
    if (!rawProd || rawProd.is_public === false) {
      directNotFound = true;
    } else {
      directProduct = {
        id: rawProd.id,
        slug: rawProd.slug,
        name: rawProd.name,
        price_ars: Number(rawProd.price_ars) || 0,
        image_url: rawProd.image_url ?? null,
        stock_quantity: Number(rawProd.stock_quantity) || 0,
      };
    }
  }

  const parsedQty = parseInt(cantidad || '1', 10);
  const initialQuantity = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;

  return (
    <>
      <Header />
      <main>
        <FinalizarCompraClient
          mode={isDirect ? 'direct' : 'cart'}
          directProduct={directProduct}
          directNotFound={directNotFound}
          initialQuantity={initialQuantity}
          storeConfig={storeConfig}
        />
      </main>
      <Footer />
    </>
  );
}
