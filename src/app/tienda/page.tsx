// Página principal de la tienda — Server Component.
// Filtra productos activos por categoría vía searchParams.
// El filtro de categoría es solo de presentación (no afecta la URL base de la tienda).
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/tienda/ProductCard';
import type { Product } from '@/lib/types/product';
import styles from './tienda.module.css';

export const metadata: Metadata = {
  title: 'Tienda | Dra. Landaburo',
  description: 'Productos de skincare recomendados por la Dra. Landaburo. Cuidado y protección para tu piel.',
};

const CATEGORIES = [
  'Limpieza',
  'Hidratación',
  'Protección solar',
  'Sérum',
  'Contorno de ojos',
  'Tratamiento específico',
  'Post-tratamiento',
] as const;

type SearchParams = { category?: string };

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  // Traemos todos los productos activos ordenados por nombre.
  // El filtro de categoría se aplica en el servidor para evitar enviar datos innecesarios.
  let query = supabase
    .from('products')
    .select('id, name, slug, description, brand_type, price_ars, compare_price_ars, image_url, images, category, stock_quantity, is_active, created_at')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data: productsRaw, error } = await query;
  const products: Product[] = productsRaw ? (productsRaw as unknown as Product[]) : [];

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.pageHeader}>
            <h1 className={styles.title}>Tienda</h1>
            <p className={styles.subtitle}>
              Productos seleccionados por la Dra. Landaburo para el cuidado diario de tu piel.
            </p>
          </div>

          {/* Filtros de categoría */}
          <div className={styles.filters} role="navigation" aria-label="Filtrar por categoría">
            <Link
              href="/tienda"
              className={`${styles.filterBtn} ${!category ? styles.filterBtnActive : ''}`}
            >
              Todos
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/tienda?category=${encodeURIComponent(cat)}`}
                className={`${styles.filterBtn} ${category === cat ? styles.filterBtnActive : ''}`}
              >
                {cat}
              </Link>
            ))}
          </div>

          {error && (
            <p className={styles.error}>
              No se pudieron cargar los productos. Intentá de nuevo más tarde.
            </p>
          )}

          {!error && products.length === 0 && (
            <p className={styles.emptyState}>
              {category
                ? `No hay productos en la categoría "${category}" por el momento.`
                : 'No hay productos disponibles por el momento.'}
            </p>
          )}

          {products.length > 0 && (
            <div className={styles.grid}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
