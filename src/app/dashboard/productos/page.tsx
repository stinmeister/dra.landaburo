// /dashboard/productos — Solo admin. Catálogo e inventario de dermocosméticos.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createProduct, toggleProduct, updateStock } from './actions';
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: products } = await admin
    .from('products')
    .select('id, name, category, price_ars, stock_quantity, min_stock_alert, is_active, image_url')
    .order('created_at', { ascending: false });

  const rows = products ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Productos</h1>
          <p className={styles.subtitle}>{rows.length} producto{rows.length !== 1 ? 's' : ''} en catálogo</p>
        </div>
      </div>

      {/* ── Tabla de productos ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio ARS</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Ajustar stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>No hay productos aún. Agregá el primero abajo.</td>
              </tr>
            )}
            {rows.map((p) => {
              const lowStock = (p.stock_quantity ?? 0) < (p.min_stock_alert ?? 5);
              return (
                <tr key={p.id} className={!p.is_active ? styles.rowInactive : ''}>
                  <td className={styles.nameCell}>
                    <span className={styles.productName}>{p.name}</span>
                  </td>
                  <td className={styles.catCell}>{p.category}</td>
                  <td className={styles.priceCell}>
                    ${Number(p.price_ars).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </td>
                  <td className={lowStock ? styles.stockLow : styles.stockOk}>
                    {p.stock_quantity ?? 0} ud.
                    {lowStock && <span className={styles.alertDot} title="Stock bajo" />}
                  </td>
                  <td>
                    <form action={toggleProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="is_active" value={String(p.is_active)} />
                      <button type="submit" className={p.is_active ? styles.activeBtn : styles.pauseBtn}>
                        {p.is_active ? 'Activo' : 'Pausado'}
                      </button>
                    </form>
                  </td>
                  <td>
                    <div className={styles.stockRow}>
                      <form action={updateStock}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="delta" value="-1" />
                        <button type="submit" className={styles.deltaBtn} disabled={(p.stock_quantity ?? 0) <= 0}>−</button>
                      </form>
                      <form action={updateStock}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="delta" value="1" />
                        <button type="submit" className={styles.deltaBtn}>+</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
