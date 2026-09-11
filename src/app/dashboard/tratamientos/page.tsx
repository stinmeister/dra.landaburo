import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserSections } from '@/lib/permissions';
import TratamientosTable from './TratamientosTable';
import { createTreatment } from './actions';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Tratamientos | Panel Dra. Landaburo' };

const CATEGORIES = [
  'Facial',
  'Corporal',
  'Capilar',
  'Dermatologia Clinica',
  'Cosmetologia',
];

export default async function TratamientosDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: selfProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (selfProfile?.role !== 'admin') redirect('/dashboard/operativo');

  // Guard server-side de seccion
  const perms = await getUserSections(user.id, selfProfile!.role);
  if (!perms.allowed.has('tratamientos')) redirect('/dashboard/operativo');

  const admin = createAdminClient();
  const { data: treatments } = await admin
    .from('treatments')
    .select('id, slug, title, category, price_ars, duration_minutes, description, professional_role, is_active')
    .order('category', { ascending: true })
    .order('title', { ascending: true });

  const rows = (treatments ?? []) as any[];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Catálogo de Tratamientos</h1>
          <p className={styles.subtitle}>
            {rows.length} tratamiento{rows.length !== 1 ? 's' : ''} registrados en base de datos
          </p>
        </div>
      </div>

      {/* ── Tabla interactiva de tratamientos ── */}
      <TratamientosTable treatments={rows} categories={CATEGORIES} />

      {/* ── Formulario nuevo tratamiento ── */}
      <div className={styles.newTreatment}>
        <h2 className={styles.sectionTitle}>Agregar nuevo tratamiento</h2>
        <form action={createTreatment} className={styles.newForm}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Título del Tratamiento</label>
              <input
                name="title"
                type="text"
                required
                className={styles.input}
                placeholder="Ej. Nordlys Rosácea & Vascular"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Familia / Categoría</label>
              <select name="category" required className={styles.input}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Precio ARS ($)</label>
              <input
                name="price_ars"
                type="number"
                min="0"
                step="0.01"
                required
                className={styles.input}
                placeholder="65000"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Duración (minutos)</label>
              <input
                name="duration_minutes"
                type="number"
                min="15"
                step="15"
                defaultValue={45}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>A cargo de</label>
              <select name="professional_role" defaultValue="medico" className={styles.input}>
                <option value="medico">Dra. Paula Landaburo / Médica</option>
                <option value="cosmetologa">Mercedes Pasquet / Cosmetóloga</option>
              </select>
            </div>

            <div className={`${styles.field} ${styles.colSpan2}`}>
              <label className={styles.label}>Descripción y alcances</label>
              <textarea
                name="description"
                rows={3}
                className={styles.textarea}
                placeholder="Descripción médica y protocolo..."
              />
            </div>
          </div>
          <button type="submit" className={styles.createBtn}>
            Crear Tratamiento
          </button>
        </form>
      </div>
    </div>
  );
}
