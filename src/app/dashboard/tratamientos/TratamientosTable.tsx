'use client';

import { useState } from 'react';
import { Edit2, X, Check, Sparkles } from 'lucide-react';
import { toggleTreatment, updateTreatment } from './actions';
import styles from './page.module.css';

interface Treatment {
  id: string;
  slug: string;
  title: string;
  category: string;
  price_ars: number;
  duration_minutes: number;
  description: string | null;
  professional_role: string | null;
  is_active: boolean;
}

interface Props {
  treatments: Treatment[];
  categories: string[];
}

export default function TratamientosTable({ treatments, categories }: Props) {
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filtered = treatments.filter(
    (t) => filterCategory === 'all' || t.category === filterCategory
  );

  return (
    <>
      {/* ── Filtros por Familia / Categoría ── */}
      <div className={styles.filterRow}>
        <button
          type="button"
          onClick={() => setFilterCategory('all')}
          className={`${styles.filterBtn} ${filterCategory === 'all' ? styles.filterBtnActive : ''}`}
        >
          Todos ({treatments.length})
        </button>
        {categories.map((c) => {
          const count = treatments.filter((t) => t.category === c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setFilterCategory(c)}
              className={`${styles.filterBtn} ${filterCategory === c ? styles.filterBtnActive : ''}`}
            >
              {c} ({count})
            </button>
          );
        })}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tratamiento</th>
              <th>Familia / Categoría</th>
              <th>Profesional</th>
              <th>Duración</th>
              <th>Precio ARS</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  No hay tratamientos en esta categoría. Agregá el primero abajo.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className={!t.is_active ? styles.rowInactive : ''}>
                <td className={styles.nameCell}>
                  <span className={styles.treatmentTitle}>{t.title}</span>
                  {t.description && (
                    <span className={styles.treatmentDesc}>{t.description}</span>
                  )}
                </td>
                <td className={styles.catCell}>
                  <span className={styles.categoryBadge}>{t.category}</span>
                </td>
                <td className={styles.roleCell}>
                  {t.professional_role === 'cosmetologa' ? 'Mercedes (Cosm.)' : 'Dra. Landaburo (Méd.)'}
                </td>
                <td className={styles.durationCell}>{t.duration_minutes || 45} min</td>
                <td className={styles.priceCell}>
                  ${Number(t.price_ars).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </td>
                <td>
                  <form action={toggleTreatment}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="is_active" value={String(t.is_active)} />
                    <button type="submit" className={t.is_active ? styles.activeBtn : styles.pauseBtn}>
                      {t.is_active ? 'Activo' : 'Pausado'}
                    </button>
                  </form>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => setEditingTreatment(t)}
                    className={styles.editBtn}
                    title="Editar tratamiento"
                  >
                    <Edit2 size={15} />
                    <span>Editar</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal de Edición ── */}
      {editingTreatment && (
        <div className={styles.modalOverlay} onClick={() => setEditingTreatment(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Editar Tratamiento: {editingTreatment.title}</h2>
              <button
                type="button"
                onClick={() => setEditingTreatment(null)}
                className={styles.closeBtn}
              >
                <X size={20} />
              </button>
            </div>

            <form
              action={async (formData) => {
                await updateTreatment(formData);
                setEditingTreatment(null);
              }}
              className={styles.modalForm}
            >
              <input type="hidden" name="id" value={editingTreatment.id} />

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Título del Tratamiento</label>
                  <input
                    name="title"
                    type="text"
                    required
                    defaultValue={editingTreatment.title}
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Familia / Categoría</label>
                  <select
                    name="category"
                    required
                    defaultValue={editingTreatment.category}
                    className={styles.input}
                  >
                    {categories.map((c) => (
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
                    defaultValue={editingTreatment.price_ars}
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Duración (minutos)</label>
                  <input
                    name="duration_minutes"
                    type="number"
                    min="15"
                    step="15"
                    defaultValue={editingTreatment.duration_minutes || 45}
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>A cargo de</label>
                  <select
                    name="professional_role"
                    defaultValue={editingTreatment.professional_role || 'medico'}
                    className={styles.input}
                  >
                    <option value="medico">Dra. Paula Landaburo / Médica</option>
                    <option value="cosmetologa">Mercedes Pasquet / Cosmetóloga</option>
                  </select>
                </div>

                <div className={`${styles.field} ${styles.colSpan2}`}>
                  <label className={styles.label}>Descripción y alcances</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editingTreatment.description || ''}
                    className={styles.textarea}
                    placeholder="Descripción médica y resultados esperados..."
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setEditingTreatment(null)}
                  className={styles.cancelBtn}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.saveBtn}>
                  <Check size={16} />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
