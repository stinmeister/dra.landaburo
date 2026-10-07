'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, X, Check, Sparkles, Search, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { toggleTreatment, updateTreatment, deleteTreatment, archiveTreatment } from './actions';
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
  isAdmin?: boolean;
}

export default function TratamientosTable({ treatments, categories, isAdmin = false }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Treatment[]>(treatments);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);

  // ── Eliminación / Archivado de Tratamiento (Fricción y RESTRICT) ──
  const [deletingTreatment, setDeletingTreatment] = useState<Treatment | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingTreatment, setIsDeletingTreatment] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [canArchiveFromError, setCanArchiveFromError] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setItems(treatments);
  }, [treatments]);

  const handleOpenDelete = (t: Treatment) => {
    setDeletingTreatment(t);
    setDeleteConfirmText('');
    setDeleteErrorMessage(null);
    setCanArchiveFromError(false);
    setDeleteSuccessMessage(null);
  };

  const handleCloseDelete = () => {
    setDeletingTreatment(null);
    setDeleteConfirmText('');
    setDeleteErrorMessage(null);
    setCanArchiveFromError(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTreatment) return;
    setIsDeletingTreatment(true);
    setDeleteErrorMessage(null);
    setCanArchiveFromError(false);

    try {
      const res = await deleteTreatment(deletingTreatment.id, deleteConfirmText);
      if (!res.success) {
        setDeleteErrorMessage(res.error || 'No se pudo eliminar el tratamiento.');
        setCanArchiveFromError(Boolean(res.canArchive));
      } else {
        setItems((prev) => prev.filter((item) => item.id !== deletingTreatment.id));
        setDeleteSuccessMessage(`Tratamiento "${deletingTreatment.title}" eliminado correctamente.`);
        setTimeout(() => {
          handleCloseDelete();
          router.refresh();
        }, 1200);
      }
    } catch (err: any) {
      setDeleteErrorMessage(err.message || 'Error inesperado al eliminar.');
    } finally {
      setIsDeletingTreatment(false);
    }
  };

  const handleArchiveInstead = async () => {
    if (!deletingTreatment) return;
    setIsDeletingTreatment(true);
    setDeleteErrorMessage(null);

    try {
      const res = await archiveTreatment(deletingTreatment.id);
      if (!res.success) {
        setDeleteErrorMessage(res.error || 'No se pudo pausar el tratamiento.');
      } else {
        setItems((prev) =>
          prev.map((item) => (item.id === deletingTreatment.id ? { ...item, is_active: false } : item))
        );
        setDeleteSuccessMessage(`Tratamiento "${deletingTreatment.title}" pausado correctamente.`);
        setTimeout(() => {
          handleCloseDelete();
          router.refresh();
        }, 1200);
      }
    } catch (err: any) {
      setDeleteErrorMessage(err.message || 'Error inesperado al archivar.');
    } finally {
      setIsDeletingTreatment(false);
    }
  };
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const allCategories = Array.from(
    new Set([...categories, ...treatments.map((t) => t.category)])
  ).filter(Boolean);

  const filtered = items.filter((t) => {
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
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setEditingTreatment(t)}
                      className={styles.editBtn}
                      title="Editar tratamiento"
                    >
                      <Edit2 size={15} />
                      <span>Editar</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(t)}
                        className={styles.editBtn}
                        style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                        title="Eliminar o archivar tratamiento"
                      >
                        <Trash2 size={14} />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
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

      {/* ── Modal de Eliminación con Fricción / Archivado (Tratamientos) ── */}
      {deletingTreatment && (
        <div className={styles.modalOverlay} onClick={handleCloseDelete}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle} style={{ color: '#dc2626' }}>
                Eliminar Tratamiento
              </h2>
              <button type="button" onClick={handleCloseDelete} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-negro)', lineHeight: 1.5 }}>
                Estás por eliminar <strong>"{deletingTreatment.title}"</strong> de la oferta de servicios.
              </p>

              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: '#991b1b',
                  lineHeight: 1.45,
                }}
              >
                <strong>Atención:</strong> Si el tratamiento cuenta con citas agendadas, registros de atención o gift cards asociadas, PostgreSQL rechazará la eliminación física por integridad referencial y podrás pausarlo en su lugar.
              </div>

              {deleteErrorMessage && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    padding: '0.85rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#92400e',
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={16} />
                    <strong>No se pudo eliminar</strong>
                  </div>
                  <p>{deleteErrorMessage}</p>
                  {canArchiveFromError && (
                    <button
                      type="button"
                      onClick={handleArchiveInstead}
                      disabled={isDeletingTreatment}
                      style={{
                        marginTop: '0.75rem',
                        backgroundColor: '#d97706',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.45rem 0.9rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Pausar tratamiento ahora
                    </button>
                  )}
                </div>
              )}

              {deleteSuccessMessage ? (
                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '0.85rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#166534',
                    fontWeight: 600,
                  }}
                >
                  ✓ {deleteSuccessMessage}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-gris)' }}>
                      Para confirmar la eliminación definitiva, escribí exactamente el título del tratamiento:
                    </label>
                    <div style={{ padding: '0.4rem 0.6rem', background: '#f3f4f6', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {deletingTreatment.title}
                    </div>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Escribí el título exacto aquí..."
                      style={{
                        padding: '0.6rem 0.8rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        width: '100%',
                      }}
                    />
                  </div>

                  <div className={styles.modalActions} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleArchiveInstead}
                      disabled={isDeletingTreatment}
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid var(--color-gris)',
                        color: 'var(--color-negro)',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Pausar en su lugar
                    </button>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={handleCloseDelete}
                        className={styles.cancelBtn}
                        disabled={isDeletingTreatment}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        disabled={
                          deleteConfirmText.trim().toLowerCase() !== deletingTreatment.title.trim().toLowerCase() ||
                          isDeletingTreatment
                        }
                        style={{
                          backgroundColor:
                            deleteConfirmText.trim().toLowerCase() === deletingTreatment.title.trim().toLowerCase()
                              ? '#dc2626'
                              : '#fca5a5',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor:
                            deleteConfirmText.trim().toLowerCase() === deletingTreatment.title.trim().toLowerCase()
                              ? 'pointer'
                              : 'not-allowed',
                        }}
                      >
                        {isDeletingTreatment ? 'Eliminando...' : 'Eliminar definitivamente'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
