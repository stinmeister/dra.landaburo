// Página de detalle de producto — Server Component.
// Busca por slug en Supabase; retorna 404 si no existe o no está activo.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AddToCartButton from '@/components/tienda/AddToCartButton';
import ProductViewTracker from '@/components/tienda/ProductViewTracker';
import { MessageCircle, MapPin } from 'lucide-react';
import type { Product } from '@/lib/types/product';
import styles from './producto.module.css';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('name, description, is_public')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!data || data.is_public === false) return { title: 'Producto no encontrado' };

  return {
    title: `${data.name} | Tienda`,
    description: data.description ?? undefined,
  };
}

const formatARS = (n: number | string | undefined | null) => {
  if (n === null || n === undefined || n === '') return 'A consultar';
  const num = typeof n === 'number' ? n : parseFloat(String(n || 0));
  if (isNaN(num) || num <= 0) return 'A consultar';
  return `$ ${Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
};

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const [productResult, storeConfigResult] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, slug, description, brand_type, price_ars, compare_price_ars, image_url, images, category, stock_quantity, is_active, is_public, created_at')
      .eq('slug', slug)
      .eq('is_active', true)
      .single(),
    supabase
      .from('store_config')
      .select('pickup_address, pickup_hours, shipping_enabled')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  const productRaw = productResult.data;
  if (!productRaw || productRaw.is_public === false) notFound();

  const storeConfig = storeConfigResult.data;
  const pickupAddress = storeConfig?.pickup_address || 'Leandro N. Alem 45, Gualeguaychú, Entre Ríos';
  const pickupHours = storeConfig?.pickup_hours || 'Lunes a Viernes de 9:00 a 17:00 hs';

  const product = productRaw as unknown as Product;
  const hasDiscount =
    product.compare_price_ars != null && product.compare_price_ars > product.price_ars;

  // Galería: imagen principal + imágenes adicionales del array `images`
  const gallery = [
    ...(product.image_url ? [product.image_url] : []),
    ...(product.images ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i); // dedup

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb} aria-label="Navegación">
            <Link href="/tienda" className={styles.breadcrumbLink}>Tienda</Link>
            <span className={styles.breadcrumbSep} aria-hidden="true">/</span>
            <span className={styles.breadcrumbCurrent}>{product.name}</span>
          </nav>

          <div className={styles.productGrid}>
            {/* Columna imagen */}
            <div className={styles.imageCol}>
              <div className={styles.mainImageWrapper}>
                {gallery.length > 0 ? (
                  <Image
                    src={gallery[0]}
                    alt={product.name}
                    fill
                    className={styles.mainImage}
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <div className={styles.imageFallback}>
                    <span>Sin imagen</span>
                  </div>
                )}
              </div>
              {gallery.length > 1 && (
                <div className={styles.thumbRow}>
                  {gallery.slice(1).map((src, idx) => (
                    <div key={idx} className={styles.thumb}>
                      <Image
                        src={src}
                        alt={`${product.name} - imagen ${idx + 2}`}
                        fill
                        className={styles.thumbImage}
                        sizes="80px"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Columna info */}
            <div className={styles.infoCol}>
              {product.brand_type && (
                <p className={styles.brandType}>{product.brand_type}</p>
              )}
              <h1 className={styles.name}>{product.name}</h1>
              {product.category && (
                <p className={styles.category}>{product.category}</p>
              )}

              {product.category === 'Medicamentos' && (
                <div style={{
                  padding: '0.65rem 0.9rem',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  borderRadius: '6px',
                  fontSize: '0.825rem',
                  fontWeight: 500,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <span>⚠️ Venta bajo receta médica. Consultá en consultorio con la Dra. Paula Landaburo.</span>
                </div>
              )}

              <div className={styles.priceBlock}>
                <span className={styles.price}>{formatARS(product.price_ars)}</span>
                {hasDiscount && (
                  <span className={styles.comparePrice}>
                    {formatARS(product.compare_price_ars!)}
                  </span>
                )}
              </div>

              {product.description && (
                <p className={styles.description}>{product.description}</p>
              )}

              <div className={styles.stockInfo}>
                {product.stock_quantity > 0 ? (
                  <span className={styles.inStock}>En stock</span>
                ) : (
                  <span className={styles.outOfStock}>Sin stock</span>
                )}
              </div>

              <AddToCartButton product={product} />

              {/* Información de entrega leída de store_config */}
              <div className={styles.deliveryBox}>
                <div className={styles.deliveryTitle}>
                  <MapPin size={16} color="var(--color-champagne-dark)" />
                  <span>Retiro en consultorio (Sin costo)</span>
                </div>
                <p className={styles.deliveryText}>
                  <strong>Dirección:</strong> {pickupAddress}<br />
                  <strong>Horario de retiro:</strong> {pickupHours}
                </p>
              </div>

              {/* Botón directo de WhatsApp para consultas */}
              <a
                href={`https://wa.me/5491169684062?text=${encodeURIComponent(`Hola, quisiera consultar sobre el producto "${product.name}".`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.whatsappCta}
                aria-label="Consultar por WhatsApp"
              >
                <MessageCircle size={18} />
                <span>Consultar por WhatsApp (+54 9 11 6968-4062)</span>
              </a>

              <p className={styles.disclaimer}>
                Producto recomendado por la Dra. Landaburo para uso en el hogar.
                Ante cualquier duda consultá con tu médica.
              </p>
            </div>
          </div>
        </div>
      </main>
      <ProductViewTracker product={product} />
      <Footer />
    </>
  );
}
