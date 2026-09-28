'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { createProduct, uploadProductImage } from './actions';
import ProductImageUploader from '@/components/dashboard/ProductImageUploader';
import styles from './page.module.css';

interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  categories: CategoryOption[];
  categoryNames: string[];
}

export default function NewProductForm({ categories, categoryNames }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategoryId);
  const isMedicamento = selectedCategoryObj?.name.toLowerCase() === 'medicamentos';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const name = (formData.get('name') as string)?.trim();

      // Bloque E: Si se seleccionó archivo con vista previa, subir al Storage antes de crear producto
      if (selectedFile) {
        const uploadData = new FormData();
        uploadData.append('file', selectedFile);
        uploadData.append('slug', name || 'producto');

        const uploadRes = await uploadProductImage(uploadData);
        if (!uploadRes.success || !uploadRes.url) {
          setErrorMessage(
            `Fallo al subir la foto del producto: ${uploadRes.error || 'Error desconocido'}. El producto no fue creado para evitar inconsistencias de URL.`
          );
          setIsSubmitting(false);
          return;
        }
        formData.set('image_url', uploadRes.url);
      }

      const res = await createProduct(formData);

      if (res.success) {
        setSuccessMessage(`¡Producto "${res.product?.name || 'Nuevo producto'}" creado correctamente!`);
        formRef.current?.reset();
        setSelectedCategoryId('');
        setSelectedFile(null);
        router.refresh();
      } else {
        setErrorMessage(res.error || 'Ocurrió un error al crear el producto.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error inesperado al intentar guardar el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.newProduct}>
      <h2 className={styles.sectionTitle}>Agregar nuevo producto al catálogo</h2>

      {errorMessage && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #f87171',
          color: '#991b1b',
          padding: '0.85rem 1rem',
          borderRadius: '6px',
          marginBottom: '1.25rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <AlertTriangle size={18} />
          <div>
            <strong>Error al crear el producto:</strong> {errorMessage}
          </div>
        </div>
      )}

      {successMessage && (
        <div style={{
          backgroundColor: '#ecfdf5',
          border: '1px solid #6ee7b7',
          color: '#065f46',
          padding: '0.85rem 1rem',
          borderRadius: '6px',
          marginBottom: '1.25rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <CheckCircle2 size={18} />
          <div>{successMessage}</div>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className={styles.newForm}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Nombre del producto *</label>
            <input
              name="name"
              type="text"
              required
              className={styles.input}
              placeholder="Ej. Bellivm Velvet Facial"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Categoría *</label>
            <select
              name="category_id"
              required
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className={styles.input}
            >
              <option value="" disabled>Seleccionar categoría...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {categories.length === 0 && categoryNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Línea / Laboratorio (brand_type)</label>
            <select name="brand_type" defaultValue="Bellivm" className={styles.input}>
              <option value="Bellivm">Bellivm</option>
              <option value="Revitalash">Revitalash</option>
              <option value="Dra. Landaburo">Dra. Landaburo</option>
              <option value="Otro">Otro laboratorio / formulación</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Precio ARS ($) (opcional)</label>
            <input
              name="price_ars"
              type="number"
              min="0"
              step="0.01"
              className={styles.input}
              placeholder="Dejar vacío si es a consultar"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Stock inicial (unidades)</label>
            <input
              name="stock_quantity"
              type="number"
              min="0"
              defaultValue="0"
              className={styles.input}
              placeholder="0"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Visibilidad en Tienda Online</label>
            <select
              name="is_public"
              value={isMedicamento ? 'false' : undefined}
              defaultValue="true"
              className={styles.input}
            >
              <option value="true">Público (visible en tienda web)</option>
              <option value="false">No público (receta médica / uso en consultorio)</option>
            </select>
          </div>

          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>Descripción médica y modo de uso (opcional)</label>
            <input
              name="description"
              type="text"
              className={styles.input}
              placeholder="Composición, presentación y modo de aplicación..."
            />
            <span style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: isMedicamento ? '#b45309' : 'var(--color-gris)', fontWeight: isMedicamento ? 600 : 400 }}>
              * Medicamentos bajo receta (Latisse, Minoxidil, Dutasteride): deben guardarse como no públicos conforme normativa ANMAT (Disp. 4059/2025).
            </span>
          </div>

          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>Foto del producto (con vista previa inmediata)</label>
            <ProductImageUploader
              onFileSelect={(file) => setSelectedFile(file)}
              isUploading={isSubmitting}
            />
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className={styles.createBtn}>
          {isSubmitting ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Loader2 size={16} className={styles.spinner} />
              Guardando producto...
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} />
              Agregar producto
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
