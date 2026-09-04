'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Edit2, Plus, Minus, X, Check, Image as ImageIcon } from 'lucide-react';
import { toggleProduct, updateStock, updateProduct } from './actions';
import styles from './page.module.css';

interface Product {
  id: string;
  name: string;
  category: string;
  price_ars: number;
  stock_quantity: number;
  is_active: boolean;
  image_url: string | null;
  description?: string | null;
}

interface Props {
  products: Product[];
  categories: string[];
}

export default function ProductTable({ products, categories }: Props) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setSelectedImage(p.image_url || '');
  };

  const handleCloseEdit = () => {
    setEditingProduct(null);
    setSelectedImage('');
  };

  return (
    <>
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
              const lowStock = (p.stock_quantity ?? 0) < 5;
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

            <form action={async (formData) => {
              await updateProduct(formData);
              handleCloseEdit();
            }} className={styles.modalForm}>
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
                  <label className={styles.label}>Ruta o URL de Imagen</label>
                  <div className={styles.imgInputGroup}>
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
                    Tip: Las imágenes del catálogo residen en <code>/images/nombre-imagen.jpg</code>
                  </span>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" onClick={handleCloseEdit} className={styles.cancelBtn}>
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
