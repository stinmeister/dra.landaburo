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
import type { Product } from '@/lib/types/product';
import styles from './producto.module.css';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('name, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!data) return { title: 'Producto no encontrado' };

  return {
    title: `${data.name} | Tienda`,
    description: data.description ?? undefined,
  };
}

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: productRaw } = await supabase
    .from('products')
    .select('id, name, slug, description, brand_type, price_ars, compare_price_ars, image_url, images, category, stock_quantity, is_active, created_at')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!productRaw) notFound();

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

              <p className={styles.disclaimer}>
                Producto recomendado por la Dra. Landaburo para uso en el hogar.
                Ante cualquier duda consultá con tu médica.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
