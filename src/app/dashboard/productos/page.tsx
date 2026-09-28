// /dashboard/productos — Solo admin. Catálogo e inventario de dermocosméticos.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { assertSectionAccess } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPendingBaselineProductIds } from './actions';
import ProductTable from './ProductTable';
import NewProductForm from './NewProductForm';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Productos | Panel Dra. Landaburo' };

const CATEGORIES = [
  'Limpieza',
  'Hidratación',
  'Protección solar',
  'Sérum',
  'Contorno de ojos',
  'Acné',
  'Rosácea',
  'Post-tratamiento',
];

export default async function ProductosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/dashboard/productos');
  const { data: selfProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = selfProfile?.role ?? '';
  if (!role || role === 'paciente') redirect('/portal/paciente');

  // Guard server-side: la matriz de permisos es la unica fuente de verdad (R6)
  await assertSectionAccess(user.id, role, 'productos');

  const admin = createAdminClient();

  // Categorías dinámicas desde DB con ID y nombre
  let dbCategories: Array<{ id: string; name: string }> = [];
  const { data: dbCats } = await admin
    .from('product_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (dbCats && dbCats.length > 0) {
    dbCategories = dbCats;
  }

  const { data: productsRaw } = await admin
    .from('products')
    .select('id, name, category, category_id, price_ars, stock_quantity, min_stock_alert, is_active, is_public, image_url, description, brand_type')
    .order('name', { ascending: true });

  const rows = productsRaw ?? [];

  const categoryNames = dbCategories.length > 0
    ? dbCategories.map((c) => c.name)
    : (Array.from(new Set(rows.map((p: any) => p.category).filter(Boolean))).sort() as string[]);

  const pendingBaselineProductIds = await getPendingBaselineProductIds();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Productos e Inventario</h1>
          <p className={styles.subtitle}>{rows.length} producto{rows.length !== 1 ? 's' : ''} en catálogo</p>
        </div>
      </div>

      {/* ── Tabla interactiva con edición, stock con motivo e historial ── */}
      <ProductTable
        products={rows}
        categories={categoryNames}
        isAdmin={role === 'admin'}
        userRole={role}
        pendingBaselineProductIds={pendingBaselineProductIds}
      />

      {/* ── Formulario interactivo nuevo producto (solo admin y operativo) ── */}
      {(role === 'admin' || role === 'operativo') && (
        <NewProductForm categories={dbCategories} categoryNames={categoryNames} />
      )}
    </div>
  );
}
