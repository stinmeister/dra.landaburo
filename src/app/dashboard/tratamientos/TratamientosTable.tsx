'use client';

import { useState } from 'react';
import { Edit2, X, Check, Sparkles, Search, RotateCcw } from 'lucide-react';
import { toggleTreatment, updateTreatment } from './actions';
import styles from './page.module.css';

interface Treatment {
  id: string;
  slug: string;
  title: string;
  category: string;
  price_ars: number | null;
  price_usd?: number | null;
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
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const allCategories = Array.from(
    new Set([...categories, ...treatments.map((t) => t.category)])
  ).filter(Boolean);

  const filtered = treatments.filter((t) => {
    // 1. Familia / Categoría
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;

    // 2. Profesional
    if (filterRole === 'medico' && t.professional_role === 'cosmetologa') return false;
    if (filterRole === 'cosmetologa' && t.professional_role !== 'cosmetologa') return false;

    // 3. Estado
    if (filterStatus === 'active' && !t.is_active) return false;
    if (filterStatus === 'paused' && t.is_active) return false;

    // 4. Búsqueda por texto (título, alcances/descripción o categoría)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const inTitle = t.title?.toLowerCase().includes(q);
      const inDesc = t.description ? t.description.toLowerCase().includes(q) : false;
      const inCat = t.category?.toLowerCase().includes(q);
      if (!inTitle && !inDesc && !inCat) return false;
    }

    return true;
  });

  const hasActiveFilters =
    filterCategory !== 'all' ||
    filterRole !== 'all' ||
    filterStatus !== 'all' ||
    !!searchQuery.trim();

  const resetFilters = () => {
    setFilterCategory('all');
    setFilterRole('all');
    setFilterStatus('all');
    setSearchQuery('');
  };

  return (
    <>
      {/* ── Barra de Filtros y Búsqueda ── */}
      <div className={styles.filtersCard}>
        {/* Barra superior: Búsqueda y Resumen */}
        <div className={styles.filterTopBar}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar tratamiento por nombre, técnica o alcance..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={styles.clearSearchBtn}
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className={styles.filterSummary}>
            <span>
              Mostrando <strong>{filtered.length}</strong> de {treatments.length} tratamientos
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className={styles.resetBtn}
                title="Restablecer todos los filtros"
              >
                <RotateCcw size={13} />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        <div className={styles.filterDivider} />

        {/* Grupos de Filtros: Categoría, Profesional y Estado */}
        <div className={styles.filterGroups}>
          {/* 1. Familia / Categoría */}
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>Familia / Categoría:</span>
            <div className={styles.filterBtnGroup}>
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`${styles.filterBtn} ${filterCategory === 'all' ? styles.filterBtnActive : ''}`}
              >
                Todas ({treatments.length})
              </button>
              {allCategories.map((c) => {
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
          </div>

          {/* 2. Profesional */}
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>Profesional a cargo:</span>
            <div className={styles.filterBtnGroup}>
              <button
                type="button"
                onClick={() => setFilterRole('all')}
                className={`${styles.filterBtn} ${filterRole === 'all' ? styles.filterBtnActive : ''}`}
              >
                Todos ({treatments.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('medico')}
                className={`${styles.filterBtn} ${filterRole === 'medico' ? styles.filterBtnActive : ''}`}
              >
                Dra. Paula Landaburo — Médica ({treatments.filter((t) => t.professional_role !== 'cosmetologa').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('cosmetologa')}
                className={`${styles.filterBtn} ${filterRole === 'cosmetologa' ? styles.filterBtnActive : ''}`}
              >
                Mercedes Pasquet — Cosmetóloga ({treatments.filter((t) => t.professional_role === 'cosmetologa').length})
              </button>
            </div>
          </div>

          {/* 3. Estado */}
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>Estado:</span>
            <div className={styles.filterBtnGroup}>
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`${styles.filterBtn} ${filterStatus === 'all' ? styles.filterBtnActive : ''}`}
              >
                Todos ({treatments.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('active')}
                className={`${styles.filterBtn} ${filterStatus === 'active' ? styles.filterBtnActive : ''}`}
              >
                Activos ({treatments.filter((t) => t.is_active).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('paused')}
                className={`${styles.filterBtn} ${filterStatus === 'paused' ? styles.filterBtnActive : ''}`}
              >
                Pausados ({treatments.filter((t) => !t.is_active).length})
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tratamiento</th>
              <th>Familia / Categoría</th>
              <th>Profesional</th>
              <th>Duración</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  <div className={styles.emptyStateContainer}>
                    <p>No se encontraron tratamientos que coincidan con los filtros seleccionados.</p>
                    {hasActiveFilters && (
                      <button type="button" onClick={resetFilters} className={styles.resetBtnInline}>
                        <RotateCcw size={14} />
                        <span>Restablecer filtros</span>
                      </button>
                    )}
                  </div>
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
                  {t.price_ars && t.price_usd ? (
                    <div>
                      <span>${Number(t.price_ars).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                      <span style={{ fontSize: '0.78rem', color: '#047857', display: 'block', fontWeight: 600 }}>USD {t.price_usd}</span>
                    </div>
                  ) : t.price_usd ? (
                    <span style={{ color: '#047857', fontWeight: 600 }}>USD {t.price_usd}</span>
                  ) : t.price_ars ? (
                    `$${Number(t.price_ars).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
                  ) : (
                    <span style={{ color: '#9ca3af' }}>A consultar</span>
                  )}
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
                    defaultValue={editingTreatment.price_ars ?? ''}
                    className={styles.input}
                    placeholder="Ej. 95000"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Precio USD (opcional)</label>
                  <input
                    name="price_usd"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={editingTreatment.price_usd ?? ''}
                    className={styles.input}
                    placeholder="Ej. 320"
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
