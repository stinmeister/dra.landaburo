'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Edit2,
  Plus,
  Minus,
  X,
  Check,
  Image as ImageIcon,
  UploadCloud,
  Loader2,
  History,
  SlidersHorizontal,
  Tags,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  toggleProduct,
  updateStock,
  updateProduct,
  uploadProductImage,
  adjustStockWithMovement,
  getStockMovements,
  getProductCategories,
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
  type StockMovementType,
} from './actions';
import styles from './page.module.css';

interface Product {
  id: string;
  name: string;
  category: string;
  price_ars: number;
  stock_quantity: number;
  min_stock_alert?: number | null;
  is_active: boolean;
  is_public?: boolean;
  image_url: string | null;
  description?: string | null;
}

interface Props {
  products: Product[];
  categories: string[];
  isAdmin?: boolean;
}

const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  recuento_fisico: 'Relevamiento / Recuento físico',
  reposicion: 'Reposición / Compra',
  venta: 'Venta',
  ajuste_diferencia: 'Ajuste por diferencia',
  baja: 'Baja por vencimiento o rotura',
};

export default function ProductTable({ products, categories, isAdmin = false }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>(products);
  const [isPending, startTransition] = useTransition();

  // ── Edición de producto ──
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // ── Stock rápido (+ / -) ──
  const [stockPendingId, setStockPendingId] = useState<string | null>(null);
  const [localStock, setLocalStock] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Ajuste explícito de stock con motivo ──
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustNewStock, setAdjustNewStock] = useState<number>(0);
  const [adjustMovementType, setAdjustMovementType] = useState<StockMovementType>('recuento_fisico');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // ── Historial de stock ──
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [historyMovements, setHistoryMovements] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyDdlPending, setHistoryDdlPending] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ── Administrador de Categorías ──
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [categoryItems, setCategoryItems] = useState<Array<{ id: string; name: string; slug: string; is_active: boolean; product_count: number }>>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [categoryActionError, setCategoryActionError] = useState<string | null>(null);
  const [catDdlPending, setCatDdlPending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(products);
  }, [products]);

  // ── Cargar categorías al abrir modal ──
  const handleOpenCategoriesModal = async () => {
    setShowCategoriesModal(true);
    setCategoryActionError(null);
    setIsLoadingCategories(true);
    try {
      const res = await getProductCategories();
      if (res.success) {
        setCategoryItems(res.categories);
        setCatDdlPending(res.ddlPending);
      } else {
        setCategoryActionError(res.error || 'Error al cargar categorías.');
      }
    } catch (err: any) {
      setCategoryActionError(err?.message || 'Error de conexión al cargar categorías.');
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategoryActionError(null);
    try {
      const res = await createCategory(newCategoryName);
      if (res.success) {
        setNewCategoryName('');
        const refreshed = await getProductCategories();
        if (refreshed.success) setCategoryItems(refreshed.categories);
        router.refresh();
      } else {
        setCategoryActionError(res.error || 'Error al crear la categoría.');
      }
    } catch (err: any) {
      setCategoryActionError(err?.message || 'Error al crear la categoría.');
    }
  };

  const handleSaveRenameCategory = async (id: string) => {
    if (!editingCatName.trim()) return;
    setCategoryActionError(null);
    try {
      const res = await updateCategory(id, editingCatName);
      if (res.success) {
        setEditingCatId(null);
        setEditingCatName('');
        const refreshed = await getProductCategories();
        if (refreshed.success) setCategoryItems(refreshed.categories);
        router.refresh();
      } else {
        setCategoryActionError(res.error || 'Error al renombrar categoría.');
      }
    } catch (err: any) {
      setCategoryActionError(err?.message || 'Error al renombrar categoría.');
    }
  };

  const handleToggleCategory = async (id: string, currentActive: boolean) => {
    setCategoryActionError(null);
    try {
      const res = await toggleCategory(id, currentActive);
      if (res.success) {
        setCategoryItems((prev) =>
          prev.map((c) => (c.id === id ? { ...c, is_active: !currentActive } : c))
        );
        router.refresh();
      } else {
        setCategoryActionError(res.error || 'Error al cambiar estado.');
      }
    } catch (err: any) {
      setCategoryActionError(err?.message || 'Error al cambiar estado.');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    setCategoryActionError(null);
    try {
      const res = await deleteCategory(id, name);
      if (res.success) {
        setCategoryItems((prev) => prev.filter((c) => c.id !== id));
        router.refresh();
      } else {
        setCategoryActionError(res.error || 'No se pudo eliminar la categoría.');
      }
    } catch (err: any) {
      setCategoryActionError(err?.message || 'Error al eliminar categoría.');
    }
  };

  // ── Historial de stock ──
  const handleOpenHistory = async (p: Product) => {
    setHistoryProduct(p);
    setIsLoadingHistory(true);
    setHistoryError(null);
    setHistoryMovements([]);
    setHistoryDdlPending(false);

    try {
      const res = await getStockMovements(p.id);
      if (res.success) {
        setHistoryMovements(res.movements || []);
        setHistoryDdlPending(res.ddlPending);
      } else {
        setHistoryError(res.error || 'Error al cargar el historial.');
      }
    } catch (err: any) {
      setHistoryError(err?.message || 'Error al consultar movimientos.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleCloseHistory = () => {
    setHistoryProduct(null);
    setHistoryMovements([]);
    setHistoryError(null);
  };

  // ── Ajuste explícito de stock ──
  const handleOpenAdjust = (p: Product) => {
    const current = localStock[p.id] ?? (p.stock_quantity ?? 0);
    setAdjustingProduct(p);
    setAdjustNewStock(current);
    setAdjustMovementType('recuento_fisico');
    setAdjustNotes('');
    setAdjustError(null);
  };

  const handleCloseAdjust = () => {
    setAdjustingProduct(null);
    setAdjustError(null);
  };

  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    setAdjustError(null);
    setIsAdjusting(true);

    try {
      const res = await adjustStockWithMovement(
        adjustingProduct.id,
        adjustNewStock,
        adjustMovementType,
        adjustNotes
      );
      if (res.success) {
        if (typeof res.newStock === 'number') {
          setLocalStock((prev) => ({ ...prev, [adjustingProduct.id]: res.newStock! }));
          setItems((prev) =>
            prev.map((item) =>
              item.id === adjustingProduct.id
                ? { ...item, stock_quantity: res.newStock! }
                : item
            )
          );
        }
        handleCloseAdjust();
        router.refresh();
      } else {
        setAdjustError(res.error || 'Error al registrar el ajuste de stock.');
      }
    } catch (err: any) {
      setAdjustError(err?.message || 'Error inesperado al ajustar stock.');
    } finally {
      setIsAdjusting(false);
    }
  };

  // ── Edición rápida + / - ──
  const handleDelta = (productId: string, delta: number) => {
    setActionError(null);
    setStockPendingId(productId);
    const defaultReason: StockMovementType = delta > 0 ? 'reposicion' : 'venta';
    startTransition(async () => {
      try {
        const res = await updateStock(productId, delta, defaultReason, `Ajuste rápido ${delta > 0 ? '+' : ''}${delta}`);
        if (!res.success) {
          setActionError(res.error || 'Error al actualizar el stock.');
        } else {
          if (typeof res.newStock === 'number') {
            setLocalStock((prev) => ({ ...prev, [productId]: res.newStock! }));
          }
          router.refresh();
        }
      } catch (err: any) {
        setActionError(err?.message || 'Error al actualizar el stock.');
      } finally {
        setStockPendingId(null);
      }
    });
  };

  // ── Edición completa de producto ──
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setSelectedCategory(p.category || '');
    setSelectedImage(p.image_url || '');
    setUploadError(null);
    setEditError(null);
  };

  const handleCloseEdit = () => {
    setEditingProduct(null);
    setSelectedCategory('');
    setSelectedImage('');
    setUploadError(null);
    setEditError(null);
  };

  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEditError(null);
    setIsSavingProduct(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set('category', selectedCategory);
      const res = await updateProduct(formData);
      if (res.success) {
        if (editingProduct) {
          const newName = (formData.get('name') as string)?.trim() || editingProduct.name;
          const newPrice = parseFloat(formData.get('price_ars') as string) || editingProduct.price_ars;
          const newStock = parseInt(formData.get('stock_quantity') as string, 10);
          const newAlert = parseInt(formData.get('min_stock_alert') as string, 10);
          const newDesc = (formData.get('description') as string)?.trim() ?? editingProduct.description;
          const newImg = (formData.get('image_url') as string)?.trim() || null;
          setItems((prev) =>
            prev.map((item) =>
              item.id === editingProduct.id
                ? {
                    ...item,
                    name: newName,
                    category: selectedCategory,
                    price_ars: newPrice,
                    stock_quantity: isNaN(newStock) ? item.stock_quantity : newStock,
                    min_stock_alert: isNaN(newAlert) ? item.min_stock_alert : newAlert,
                    description: newDesc,
                    image_url: newImg,
                  }
                : item
            )
          );
        }
        handleCloseEdit();
        router.refresh();
      } else {
        setEditError(res.error || 'Error al guardar los cambios del producto.');
      }
    } catch (err: any) {
      setEditError(err?.message || 'Error inesperado al guardar.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Por favor seleccioná un archivo de imagen (PNG, JPG o WEBP).');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await uploadProductImage(formData);
    setIsUploading(false);

    if (res.success && res.url) {
      setSelectedImage(res.url);
    } else {
      setUploadError(res.error || 'Error al subir la imagen.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={handleOpenCategoriesModal}
          className={styles.manageCatBtn}
          title="Administrar categorías de productos"
        >
          <Tags size={16} />
          <span>Gestionar Categorías</span>
        </button>
      </div>

      {actionError && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #f87171',
          color: '#991b1b',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontSize: '0.875rem'
        }}>
          ⚠️ <strong>Error en producto:</strong> {actionError}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio ARS</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Rápido</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  No hay productos aún. Agregá el primero abajo.
                </td>
              </tr>
            )}
            {items.map((p) => {
              const currentStock = localStock[p.id] ?? (p.stock_quantity ?? 0);
              const threshold = p.min_stock_alert ?? 5;
              const isOut = currentStock === 0;
              const lowStock = currentStock <= threshold;
              const isUpdatingThis = stockPendingId === p.id;
              return (
                <tr key={p.id} className={!p.is_active ? styles.rowInactive : ''}>
                  <td className={styles.imgCell}>
                    <div className={styles.thumbWrapper}>
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          width={44}
                          height={44}
                          className={styles.thumbImg}
                        />
                      ) : (
                        <div className={styles.thumbPlaceholder}>
                          <ImageIcon size={20} color="#848484" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={styles.nameCell}>
                    <span className={styles.productName}>
                      {p.name}
                      {p.is_public === false && (
                        <span className={styles.badgeInternal} title="Producto de uso interno (no se publica en la tienda web)">
                          Uso interno
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={styles.catCell}>{p.category}</td>
                  <td className={styles.priceCell}>
                    ${Number(p.price_ars).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </td>
                  <td className={isOut ? styles.stockLow : (lowStock ? styles.stockLow : styles.stockOk)}>
                    {currentStock} ud.
                    {isOut ? (
                      <span className={styles.alertDot} title="Sin stock (0 unidades)" style={{ backgroundColor: '#e53e3e' }} />
                    ) : lowStock ? (
                      <span className={styles.alertDot} title={`Stock bajo (${currentStock} <= umbral de ${threshold} ud.)`} />
                    ) : null}
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
                      <button
                        type="button"
                        onClick={() => handleDelta(p.id, -1)}
                        className={styles.deltaBtn}
                        disabled={currentStock <= 0 || isUpdatingThis}
                        title="Venta rápida: Disminuir stock en 1"
                      >
                        {isUpdatingThis ? '…' : '−'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelta(p.id, 1)}
                        className={styles.deltaBtn}
                        disabled={isUpdatingThis}
                        title="Reposición rápida: Aumentar stock en 1"
                      >
                        {isUpdatingThis ? '…' : '+'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      <button
                        type="button"
                        onClick={() => handleOpenAdjust(p)}
                        className={styles.adjustBtn}
                        title="Ajustar stock con motivo y nota libre"
                      >
                        <SlidersHorizontal size={13} />
                        <span>Ajustar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(p)}
                        className={styles.historyBtn}
                        title="Ver historial cronológico de movimientos"
                      >
                        <History size={13} />
                        <span>Historial</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className={styles.editBtn}
                        title="Editar ficha e imagen"
                      >
                        <Edit2 size={13} />
                        <span>Editar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal de Ajuste de Stock con Motivo ── */}
      {adjustingProduct && (
        <div className={styles.modalOverlay} onClick={handleCloseAdjust}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Ajustar Stock: {adjustingProduct.name}</h2>
              <button type="button" onClick={handleCloseAdjust} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            {adjustError && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #f87171',
                color: '#991b1b',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                ⚠️ <strong>Error:</strong> {adjustError}
              </div>
            )}

            <form onSubmit={handleSubmitAdjust} className={styles.modalForm}>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8f8f8', borderRadius: '6px', fontSize: '0.875rem' }}>
                <span>Stock actual: <strong>{localStock[adjustingProduct.id] ?? adjustingProduct.stock_quantity} unidades</strong></span>
                {adjustNewStock !== (localStock[adjustingProduct.id] ?? adjustingProduct.stock_quantity) && (
                  <span style={{ marginLeft: '1rem', color: adjustNewStock > (localStock[adjustingProduct.id] ?? adjustingProduct.stock_quantity) ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                    Diferencia: {adjustNewStock - (localStock[adjustingProduct.id] ?? adjustingProduct.stock_quantity) > 0 ? '+' : ''}
                    {adjustNewStock - (localStock[adjustingProduct.id] ?? adjustingProduct.stock_quantity)}
                  </span>
                )}
              </div>

              <div className={styles.field} style={{ marginBottom: '1rem' }}>
                <label className={styles.label}>Nuevo Stock Físico (unidades)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustNewStock}
                  onChange={(e) => setAdjustNewStock(parseInt(e.target.value, 10) || 0)}
                  className={styles.input}
                  placeholder="Ej. 8"
                />
              </div>

              <div className={styles.field} style={{ marginBottom: '1rem' }}>
                <label className={styles.label}>Motivo del Movimiento</label>
                <select
                  value={adjustMovementType}
                  onChange={(e) => setAdjustMovementType(e.target.value as StockMovementType)}
                  className={styles.input}
                  required
                >
                  <option value="recuento_fisico">Relevamiento / Recuento físico</option>
                  <option value="reposicion">Reposición / Compra a droguería</option>
                  <option value="venta">Venta en mostrador</option>
                  <option value="ajuste_diferencia">Ajuste por diferencia de inventario</option>
                  <option value="baja">Baja por vencimiento o rotura</option>
                </select>
              </div>

              <div className={styles.field} style={{ marginBottom: '1.5rem' }}>
                <label className={styles.label}>Nota / Comentario explicativo (opcional)</label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className={styles.input}
                  placeholder="Ej. Relevamiento viernes Ceci / Rotura de frasco en cabina"
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" onClick={handleCloseAdjust} className={styles.cancelBtn} disabled={isAdjusting}>
                  Cancelar
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isAdjusting}>
                  {isAdjusting ? <Loader2 size={16} className={styles.spinner} /> : <Check size={16} />}
                  <span>{isAdjusting ? 'Guardando...' : 'Confirmar Ajuste'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Historial de Stock ── */}
      {historyProduct && (
        <div className={styles.modalOverlay} onClick={handleCloseHistory}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Historial de Stock: {historyProduct.name}</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-gris)' }}>
                  Auditoría completa de movimientos, motivos y autores.
                </p>
              </div>
              <button type="button" onClick={handleCloseHistory} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            {historyDdlPending && (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                marginTop: '1rem',
                fontSize: '0.85rem'
              }}>
                ℹ️ <strong>Aviso:</strong> La tabla <code>stock_movements</code> aún no ha sido aprovisionada en la base de datos de Supabase. Una vez ejecutada la migración DDL propuesta, los movimientos quedarán registrados aquí de manera inmutable.
              </div>
            )}

            {historyError && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #f87171',
                color: '#991b1b',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                marginTop: '1rem',
                fontSize: '0.85rem'
              }}>
                ⚠️ <strong>Error:</strong> {historyError}
              </div>
            )}

            {isLoadingHistory ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem', color: 'var(--color-gris)' }}>
                <Loader2 size={24} className={styles.spinner} />
                <span>Cargando movimientos de stock...</span>
              </div>
            ) : historyMovements.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-gris)', fontSize: '0.9rem' }}>
                No hay movimientos registrados para este producto aún.
              </div>
            ) : (
              <div className={styles.historyTableWrap}>
                <table className={styles.historyTable}>
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Autor</th>
                      <th>Motivo</th>
                      <th>Variación</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyMovements.map((m) => {
                      const d = new Date(m.created_at);
                      const formattedDate = !isNaN(d.getTime())
                        ? d.toLocaleString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : m.created_at;

                      const typeLabel = MOVEMENT_TYPE_LABELS[m.movement_type as StockMovementType] || m.movement_type;
                      let badgeClass = styles.badgeTypeRecuento;
                      if (m.movement_type === 'reposicion') badgeClass = styles.badgeTypeReposicion;
                      else if (m.movement_type === 'venta') badgeClass = styles.badgeTypeVenta;
                      else if (m.movement_type === 'ajuste_diferencia') badgeClass = styles.badgeTypeAjuste;
                      else if (m.movement_type === 'baja') badgeClass = styles.badgeTypeBaja;

                      return (
                        <tr key={m.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formattedDate}</td>
                          <td>{m.profiles?.full_name || 'Staff'}</td>
                          <td>
                            <span className={`${styles.badgeType} ${badgeClass}`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {m.previous_stock} → <strong>{m.new_stock}</strong>{' '}
                            <span className={m.quantity_delta > 0 ? styles.deltaPositive : m.quantity_delta < 0 ? styles.deltaNegative : styles.deltaZero}>
                              ({m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta})
                            </span>
                          </td>
                          <td style={{ color: 'var(--color-gris)' }}>{m.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className={styles.modalActions}>
              <button type="button" onClick={handleCloseHistory} className={styles.cancelBtn}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Administrador de Categorías ── */}
      {showCategoriesModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCategoriesModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Gestionar Categorías</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-gris)' }}>
                  Creá, renombrá o desactivá categorías del catálogo sin necesidad de deploy.
                </p>
              </div>
              <button type="button" onClick={() => setShowCategoriesModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            {catDdlPending && (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                marginTop: '0.75rem',
                fontSize: '0.85rem'
              }}>
                ℹ️ <strong>Aviso DDL:</strong> Mostrando categorías actuales en base a los productos cargados. Para persistir nuevas categorías de manera permanente, ejecute la migración DDL en Supabase.
              </div>
            )}

            {categoryActionError && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #f87171',
                color: '#991b1b',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                marginTop: '0.75rem',
                fontSize: '0.85rem'
              }}>
                ⚠️ {categoryActionError}
              </div>
            )}

            {/* Formulario de nueva categoría */}
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <input
                type="text"
                placeholder="Nueva categoría (ej. Suplementos)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className={styles.input}
                style={{ flex: 1 }}
              />
              <button type="submit" className={styles.saveBtn} style={{ padding: '0.5rem 1rem' }}>
                <Plus size={16} />
                <span>Agregar</span>
              </button>
            </form>

            {isLoadingCategories ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '0.5rem', color: 'var(--color-gris)' }}>
                <Loader2 size={20} className={styles.spinner} />
                <span>Cargando categorías...</span>
              </div>
            ) : (
              <div className={styles.categoryList}>
                {categoryItems.map((cat) => (
                  <div key={cat.id} className={styles.categoryRow}>
                    <div className={styles.categoryInfo}>
                      {editingCatId === cat.id ? (
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className={styles.input}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}
                        />
                      ) : (
                        <span style={{ fontWeight: 500, color: cat.is_active ? 'var(--color-negro)' : 'var(--color-gris)' }}>
                          {cat.name}
                        </span>
                      )}
                      <span className={styles.categoryCount}>
                        {cat.product_count} prod.
                      </span>
                      {!cat.is_active && (
                        <span style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 600, background: '#fee2e2', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          Inactiva
                        </span>
                      )}
                    </div>

                    <div className={styles.categoryActions}>
                      {editingCatId === cat.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveRenameCategory(cat.id)}
                            className={styles.iconBtn}
                            title="Guardar nombre"
                          >
                            <Check size={16} color="#15803d" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingCatId(null); setEditingCatName(''); }}
                            className={styles.iconBtn}
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                          className={styles.iconBtn}
                          title="Renombrar categoría"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleCategory(cat.id, cat.is_active)}
                        className={styles.iconBtn}
                        title={cat.is_active ? 'Desactivar (no se ofrecerá para nuevos productos)' : 'Activar categoría'}
                      >
                        {cat.is_active ? (
                          <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>Activa</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>Inactiva</span>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={cat.product_count > 0}
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className={styles.iconBtn}
                        title={
                          cat.product_count > 0
                            ? 'No se puede eliminar porque contiene productos asignados'
                            : 'Eliminar categoría vacía'
                        }
                      >
                        <Trash2 size={14} color={cat.product_count > 0 ? '#ccc' : '#b91c1c'} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.modalActions}>
              <button type="button" onClick={() => setShowCategoriesModal(false)} className={styles.cancelBtn}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Edición de Producto ── */}
      {editingProduct && (
        <div className={styles.modalOverlay} onClick={handleCloseEdit}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Editar Producto: {editingProduct.name}</h2>
              <button type="button" onClick={handleCloseEdit} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #f87171',
                color: '#991b1b',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                ⚠️ <strong>Error al guardar producto:</strong> {editError}
              </div>
            )}

            <form key={editingProduct.id} onSubmit={handleSubmitEdit} className={styles.modalForm}>
              <input type="hidden" name="id" value={editingProduct.id} />

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre</label>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={editingProduct.name}
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Categoría</label>
                  <select
                    name="category"
                    required
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={styles.input}
                  >
                    {!selectedCategory && (
                      <option value="" disabled>Seleccionar categoría...</option>
                    )}
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    {selectedCategory && !categories.includes(selectedCategory) && (
                      <option value={selectedCategory}>{selectedCategory}</option>
                    )}
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
                    defaultValue={editingProduct.price_ars}
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Stock Disponible</label>
                  <input
                    name="stock_quantity"
                    type="number"
                    min="0"
                    defaultValue={editingProduct.stock_quantity ?? 0}
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Umbral Alerta Mínima</label>
                  <input
                    name="min_stock_alert"
                    type="number"
                    min="0"
                    defaultValue={editingProduct.min_stock_alert ?? 5}
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Motivo de cambio de stock (si varió)</label>
                  <select name="movement_type" defaultValue="recuento_fisico" className={styles.input}>
                    <option value="recuento_fisico">Relevamiento / Recuento físico</option>
                    <option value="reposicion">Reposición / Compra</option>
                    <option value="venta">Venta</option>
                    <option value="ajuste_diferencia">Ajuste por diferencia</option>
                    <option value="baja">Baja por vencimiento o rotura</option>
                  </select>
                </div>

                <div className={`${styles.field} ${styles.colSpan2}`}>
                  <label className={styles.label}>Descripción</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editingProduct.description || ''}
                    className={styles.textarea}
                    placeholder="Descripción médica y modo de uso..."
                  />
                </div>

                <div className={`${styles.field} ${styles.colSpan2}`}>
                  <label className={styles.label}>Imagen del Producto</label>
                  
                  {/* Dropzone para Drag & Drop */}
                  <div
                    className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    {isUploading ? (
                      <div className={styles.uploadingState}>
                        <Loader2 size={24} className={styles.spinner} />
                        <span>Subiendo imagen a Supabase Storage...</span>
                      </div>
                    ) : (
                      <div className={styles.dropzoneContent}>
                        <UploadCloud size={24} color="#C5A47E" />
                        <div>
                          <p className={styles.dropzoneTitle}>
                            <strong>Hacé clic</strong> o arrastrá una imagen acá
                          </p>
                          <p className={styles.dropzoneHint}>PNG, JPG o WEBP (máx. 5MB)</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {uploadError && (
                    <p className={styles.uploadErrorText}>{uploadError}</p>
                  )}

                  <div className={styles.imgInputGroup} style={{ marginTop: '0.75rem' }}>
                    <input
                      name="image_url"
                      type="text"
                      value={selectedImage}
                      onChange={(e) => setSelectedImage(e.target.value)}
                      className={styles.input}
                      placeholder="/images/nombre-imagen.jpg o https://..."
                    />
                    {selectedImage && (
                      <div className={styles.imgPreview}>
                        <Image
                          src={selectedImage}
                          alt="Preview"
                          width={48}
                          height={48}
                          className={styles.previewThumb}
                          onError={() => {}}
                        />
                      </div>
                    )}
                  </div>
                  <span className={styles.helperText}>
                    Tip: Podés arrastrar una foto nueva o ingresar la ruta de imagen existente.
                  </span>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" onClick={handleCloseEdit} className={styles.cancelBtn} disabled={isSavingProduct}>
                  Cancelar
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isSavingProduct}>
                  {isSavingProduct ? <Loader2 size={16} className={styles.spinner} /> : <Check size={16} />}
                  <span>{isSavingProduct ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
