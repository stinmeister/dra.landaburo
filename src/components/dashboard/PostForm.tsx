'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { uploadBlogCover } from '@/app/dashboard/blog/actions';
import styles from './PostForm.module.css';

interface PostData {
  id?: string;
  title?: string;
  category?: string;
  slug?: string;
  excerpt?: string;
  cover_image_url?: string | null;
  content?: string;
  is_published?: boolean;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  post?: PostData;
}

export default function PostForm({ action, post }: Props) {
  const [coverUrl, setCoverUrl] = useState<string>(post?.cover_image_url ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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

    const res = await uploadBlogCover(formData);
    setIsUploading(false);

    if (res.success && res.url) {
      setCoverUrl(res.url);
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

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {post?.id ? 'Editar artículo' : 'Nuevo artículo'}
          </h1>
          {post?.id && (
            <div className={styles.dateMeta}>
              <span>Publicado: <strong>{formatDate(post.published_at)}</strong></span>
              <span> · </span>
              <span>Última edición: <strong>{formatDate(post.updated_at || post.created_at)}</strong></span>
            </div>
          )}
        </div>

        {post?.slug && (
          <Link
            href={`/blog/preview/${post.slug}`}
            target="_blank"
            className={styles.previewBtn}
          >
            👁️ Vista previa borrador
          </Link>
        )}
      </div>

      <form action={action} className={styles.form}>
        {post?.id && <input type="hidden" name="id" value={post.id} />}
        <input type="hidden" name="cover_image_url" value={coverUrl} />

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Título *</label>
            <input
              name="title"
              type="text"
              required
              defaultValue={post?.title ?? ''}
              placeholder="Ej: Cuidado de la piel en verano y fotoprotección"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Categoría</label>
            <select
              name="category"
              defaultValue={post?.category ?? 'Dermatología'}
              className={styles.select}
            >
              {[
                'Dermatología',
                'Medicina Estética',
                'Cuidado de la piel',
                'Tecnología médica',
                'Consejos',
                'Tratamientos Capilares',
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>Slug (URL amigable)</label>
            <input
              name="slug"
              type="text"
              defaultValue={post?.slug ?? ''}
              placeholder="cuidado-piel-verano (se genera automáticamente a partir del título si lo dejás vacío)"
              className={styles.input}
            />
          </div>

          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>Resumen (Excerpt)</label>
            <input
              name="excerpt"
              type="text"
              defaultValue={post?.excerpt ?? ''}
              placeholder="Un párrafo breve que sintetiza el artículo y aparece en el listado del blog..."
              className={styles.input}
            />
          </div>

          {/* Cover image drag & drop + preview */}
          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>Imagen de Portada (Drag & Drop o URL)</label>
            <div
              className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              {coverUrl ? (
                <div className={styles.previewContainer}>
                  <div className={styles.previewImageWrapper}>
                    <Image
                      src={coverUrl}
                      alt="Vista previa de portada"
                      fill
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  </div>
                  <div className={styles.previewControls}>
                    <p className={styles.previewText}>Imagen cargada correctamente</p>
                    <button
                      type="button"
                      onClick={() => setCoverUrl('')}
                      className={styles.removeImageBtn}
                    >
                      Quitar imagen
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.dropZonePrompt}>
                  <span className={styles.dropIcon}>🖼️</span>
                  <p className={styles.dropPromptText}>
                    {isUploading
                      ? 'Subiendo imagen...'
                      : 'Arrastrá y soltá una imagen acá, o hacé clic para seleccionar'}
                  </p>
                  <label className={styles.browseBtn}>
                    Examinar archivo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>

            {uploadError && <p className={styles.uploadError}>{uploadError}</p>}

            <div className={styles.manualUrlRow}>
              <span className={styles.manualUrlLabel}>O ingresá la URL manualmente:</span>
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://..."
                className={styles.input}
              />
            </div>
          </div>

          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>Contenido del Artículo (Markdown o texto)</label>
            <textarea
              name="content"
              rows={16}
              defaultValue={post?.content ?? ''}
              placeholder="Escribí el cuerpo del artículo aquí..."
              className={styles.textarea}
            />
          </div>
        </div>

        <div className={styles.formFooter}>
          <div className={styles.publishToggle}>
            <label className={styles.checkLabel}>
              <input
                name="is_published"
                type="checkbox"
                value="true"
                defaultChecked={post?.is_published === true}
                className={styles.checkbox}
              />
              <span>Publicar inmediatamente</span>
            </label>
          </div>

          <div className={styles.footerBtns}>
            <Link href="/dashboard/blog" className={styles.cancelBtn}>
              Cancelar
            </Link>
            <button type="submit" className={styles.saveBtn}>
              {post?.id ? 'Guardar Cambios' : 'Crear Artículo'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
