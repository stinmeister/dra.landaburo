// /dashboard/productos — Solo admin. Catálogo e inventario de dermocosméticos.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import ProductTable from './ProductTable';
import { createProduct } from './actions';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Productos | Panel Dra. Landaburo' };

const CATEGORIES = [
  'Limpieza', 'Hidratación', 'Protección solar',
  'Sérum', 'Contorno de ojos', 'Tratamiento específico', 'Post-tratamiento',
];

export default async function ProductosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: selfProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (selfProfile?.role !== 'admin') redirect('/dashboard/operativo');

  const admin = createAdminClient();
  const { data: products } = await admin
    .from('products')
    .select('id, name, category, price_ars, stock_quantity, is_active, image_url, description')
    .order('name', { ascending: true });

  const rows = (products ?? []) as any[];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Productos</h1>
          <p className={styles.subtitle}>{rows.length} producto{rows.length !== 1 ? 's' : ''} en catálogo</p>
        </div>
      </div>

      {/* ── Tabla interactiva con edición ── */}
      <ProductTable products={rows} categories={CATEGORIES} />

      {/* ── Formulario nuevo producto ── */}
      <div className={styles.newProduct}>
        <h2 className={styles.sectionTitle}>Agregar producto</h2>
        <form action={createProduct} className={styles.newForm}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre</label>
              <input name="name" type="text" required className={styles.input} placeholder="Sérum Vitamina C" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Categoría</label>
              <select name="category" required className={styles.input}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Precio ARS</label>
              <input name="price_ars" type="number" min="0" step="0.01" required className={styles.input} placeholder="12500" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Stock inicial</label>
              <input name="stock_quantity" type="number" min="0" className={styles.input} placeholder="10" />
            </div>
            <div className={`${styles.field} ${styles.colSpan2}`}>
              <label className={styles.label}>Descripción médica (opcional)</label>
              <input name="description" type="text" className={styles.input} placeholder="Hidratante con ácido hialurónico..." />
            </div>
            <div className={`${styles.field} ${styles.colSpan2}`}>
              <label className={styles.label}>URL de imagen (opcional)</label>
              <input name="image_url" type="url" className={styles.input} placeholder="https://..." />
            </div>
          </div>
          <button type="submit" className={styles.createBtn}>Agregar producto</button>
        </form>
      </div>
    </div>
  );
}
