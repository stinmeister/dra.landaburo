'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Edit2, Plus, Minus, X, Check, Image as ImageIcon, UploadCloud, Loader2 } from 'lucide-react';
import { toggleProduct, updateStock, updateProduct, uploadProductImage } from './actions';
import styles from './page.module.css';

interface Product {
  id: string;
  name: string;
  category: string;
  price_ars: number;
  stock_quantity: number;
  min_stock_alert?: number | null;
  is_active: boolean;
  image_url: string | null;
  description?: string | null;
}

interface Props {
  products: Product[];
  categories: string[];
}

export default function ProductTable({ products, categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [stockPendingId, setStockPendingId] = useState<string | null>(null);
  const [localStock, setLocalStock] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setSelectedImage(p.image_url || '');
    setUploadError(null);
    setEditError(null);
  };

  const handleCloseEdit = () => {
    setEditingProduct(null);
    setSelectedImage('');
    setUploadError(null);
    setEditError(null);
  };

  const handleDelta = (productId: string, delta: number) => {
    setActionError(null);
    setStockPendingId(productId);
    startTransition(async () => {
      try {
        const res = await updateStock(productId, delta);
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

  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEditError(null);
    setIsSavingProduct(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await updateProduct(formData);
      if (res.success) {
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
              <th>Ajustar</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  No hay productos aún. Agregá el primero abajo.
                </td>
              </tr>
            )}
            {products.map((p) => {
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
                    <span className={styles.productName}>{p.name}</span>
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
                        title="Disminuir stock en 1"
                      >
                        {isUpdatingThis ? '…' : '−'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelta(p.id, 1)}
                        className={styles.deltaBtn}
                        disabled={isUpdatingThis}
                        title="Aumentar stock en 1"
                      >
                        {isUpdatingThis ? '…' : '+'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      className={styles.editBtn}
                      title="Editar producto e imagen"
                    >
                      <Edit2 size={15} />
                      <span>Editar</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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

            <form onSubmit={handleSubmitEdit} className={styles.modalForm}>
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
                    defaultValue={editingProduct.category}
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
