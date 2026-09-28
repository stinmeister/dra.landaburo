'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Power,
} from 'lucide-react';
import {
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
} from '../actions';
import styles from './categorias.module.css';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  display_order: number;
  product_count: number;
}

interface Props {
  initialCategories: CategoryItem[];
  loadError?: string;
  userRole: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function CategoriasClient({
  initialCategories,
  loadError,
  userRole,
}: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [isPending, startTransition] = useTransition();

  // ── Formulario Nueva Categoría ──
  const [newName, setNewName] = useState('');
  const [newOrder, setNewOrder] = useState<number>(50);
  const [isCreating, setIsCreating] = useState(false);

  // ── Modal Edición ──
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editOrder, setEditOrder] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  // ── Alertas / Feedback ──
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(loadError || null);

  const previewSlug = slugify(newName);

  // ── Crear Categoría ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    setAlertSuccess(null);
    setAlertError(null);

    const res = await createCategory(newName.trim(), newOrder);
    setIsCreating(false);

    if (res.success) {
      setAlertSuccess(`Categoría "${newName.trim()}" creada con éxito.`);
      setNewName('');
      setNewOrder(50);
      startTransition(() => {
        router.refresh();
      });
    } else {
      setAlertError(res.error || 'Error al crear la categoría.');
    }
  };

  // ── Abrir Edición ──
  const openEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditOrder(cat.display_order);
    setAlertSuccess(null);
    setAlertError(null);
  };

  // ── Guardar Edición ──
  const handleUpdate = async () => {
    if (!editingCategory || !editName.trim()) return;

    setIsUpdating(true);
    setAlertSuccess(null);
    setAlertError(null);

    const res = await updateCategory(editingCategory.id, editName.trim(), editOrder);
    setIsUpdating(false);

    if (res.success) {
      setAlertSuccess(`Categoría "${editName.trim()}" actualizada.`);
      setEditingCategory(null);
      startTransition(() => {
        router.refresh();
      });
    } else {
      setAlertError(res.error || 'Error al actualizar la categoría.');
    }
  };

  // ── Alternar Estado Activo / Inactivo ──
  const handleToggle = async (cat: CategoryItem) => {
    setAlertSuccess(null);
    setAlertError(null);

    const res = await toggleCategory(cat.id, cat.is_active);
    if (res.success) {
      setAlertSuccess(
        `Categoría "${cat.name}" ${cat.is_active ? 'desactivada' : 'activada'}.`
      );
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, is_active: !c.is_active } : c))
      );
      startTransition(() => {
        router.refresh();
      });
    } else {
      setAlertError(res.error || 'Error al alternar estado.');
    }
  };

  // ── Eliminar Categoría ──
  const handleDelete = async (cat: CategoryItem) => {
    if (cat.product_count > 0) {
      setAlertError(
        `Bloqueado: La categoría "${cat.name}" tiene ${cat.product_count} producto(s) asignado(s). Para ocultarla del catálogo podés desactivarla.`
      );
      return;
    }

    if (
      !window.confirm(
        `¿Confirmás eliminar definitivamente la categoría "${cat.name}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setAlertSuccess(null);
    setAlertError(null);

    const res = await deleteCategory(cat.id, cat.name);
    if (res.success) {
      setAlertSuccess(`Categoría "${cat.name}" eliminada.`);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      startTransition(() => {
        router.refresh();
      });
    } else {
      setAlertError(res.error || 'Error al eliminar la categoría.');
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Encabezado ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Categorías de Productos</h1>
          <p className={styles.subtitle}>
            Administrá las categorías del catálogo, su visibilidad en la tienda y orden de aparición.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/dashboard/productos" className={styles.btnSecondary}>
            <ArrowLeft size={16} />
            <span>Volver a Productos</span>
          </Link>
        </div>
      </div>

      {/* ── Banners de Alerta ── */}
      {alertSuccess && (
        <div className={styles.alertSuccess}>
          <Check size={18} />
          <span>{alertSuccess}</span>
        </div>
      )}

      {alertError && (
        <div className={styles.alertError}>
          <AlertTriangle size={18} />
          <span>{alertError}</span>
        </div>
      )}

      {/* ── Formulario Nueva Categoría ── */}
      <div className={styles.createCard}>
        <h2 className={styles.createTitle}>Crear Nueva Categoría</h2>
        <form onSubmit={handleCreate} className={styles.formGrid}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Nombre de la Categoría *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Accesorios, Suplementos, Colágeno..."
              className={styles.fieldInput}
              required
            />
            {previewSlug && (
              <span className={styles.slugPreview}>
                slug autogenerado: /{previewSlug}
              </span>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Orden de Visualización</label>
            <input
              type="number"
              value={newOrder}
              onChange={(e) => setNewOrder(parseInt(e.target.value, 10) || 0)}
              className={styles.fieldInput}
            />
          </div>

          <button
            type="submit"
            disabled={isCreating || !newName.trim()}
            className={styles.btnPrimary}
          >
            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span>Crear Categoría</span>
          </button>
        </form>
      </div>

      {/* ── Listado de Categorías ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Orden</th>
              <th>Nombre</th>
              <th>Slug</th>
              <th style={{ textAlign: 'center' }}>Productos</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gris)' }}>
                  No hay categorías registradas.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ fontWeight: 600, color: 'var(--color-gris)' }}>
                    #{cat.display_order}
                  </td>
                  <td style={{ fontWeight: 500 }}>{cat.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--color-gris)' }}>
                    {cat.slug}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={styles.countBadge}>
                      {cat.product_count} {cat.product_count === 1 ? 'producto' : 'productos'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {cat.is_active ? (
                      <span className={styles.badgeActive}>Activa</span>
                    ) : (
                      <span className={styles.badgeInactive}>Inactiva</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className={styles.actionsCell} style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(cat)}
                        className={styles.btnAction}
                        title="Editar categoría"
                      >
                        <Edit2 size={14} />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggle(cat)}
                        className={styles.btnAction}
                        title={cat.is_active ? 'Desactivar de la tienda' : 'Activar en la tienda'}
                      >
                        <Power size={14} color={cat.is_active ? '#15803d' : '#6b7280'} />
                        <span>{cat.is_active ? 'Desactivar' : 'Activar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className={`${styles.btnAction} ${styles.btnActionDanger}`}
                        title={
                          cat.product_count > 0
                            ? 'No se puede borrar: tiene productos'
                            : 'Eliminar categoría'
                        }
                      >
                        <Trash2 size={14} />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal de Edición ── */}
      {editingCategory && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Editar Categoría</h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className={styles.modalClose}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={styles.fieldInput}
                />
                <span className={styles.slugPreview}>
                  nuevo slug: /{slugify(editName)}
                </span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Orden de Visualización</label>
                <input
                  type="number"
                  value={editOrder}
                  onChange={(e) => setEditOrder(parseInt(e.target.value, 10) || 0)}
                  className={styles.fieldInput}
                />
              </div>

              {editingCategory.product_count > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-gris)', background: '#f9fafb', padding: '0.75rem', borderRadius: '6px' }}>
                  Esta categoría tiene <strong>{editingCategory.product_count}</strong> producto(s) asignados.
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className={styles.btnSecondary}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isUpdating || !editName.trim()}
                className={styles.btnPrimary}
              >
                {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
