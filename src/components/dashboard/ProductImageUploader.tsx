'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { UploadCloud, Image as ImageIcon, X, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import styles from './ProductImageUploader.module.css';

interface ProductImageUploaderProps {
  initialImageUrl?: string | null;
  onFileSelect?: (file: File | null) => void;
  onUrlChange?: (url: string | null) => void;
  isUploading?: boolean;
}

export default function ProductImageUploader({
  initialImageUrl,
  onFileSelect,
  onUrlChange,
  isUploading = false,
}: ProductImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl || null);
  const [objectUrlToRevoke, setObjectUrlToRevoke] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; sizeFormatted: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Limpieza estricta de memoria de URL.createObjectURL al desmontar o cambiar
  useEffect(() => {
    return () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [objectUrlToRevoke]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleValidateAndSelect = (file: File) => {
    setError(null);

    // 1. Validar formato (solo JPG, PNG, WEBP)
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setError('Formato no permitido: solo se aceptan imágenes JPG, PNG o WEBP.');
      return;
    }

    // 2. Validar tamaño (máximo 5 MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(
        `La imagen pesa ${formatFileSize(file.size)}. El límite máximo permitido es de 5 MB.`
      );
      return;
    }

    // 3. Liberar URL previa si existía
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }

    // 4. Crear nueva URL de previsualización cliente inmediata
    const newObjUrl = URL.createObjectURL(file);
    setObjectUrlToRevoke(newObjUrl);
    setPreviewUrl(newObjUrl);
    setFileInfo({
      name: file.name,
      sizeFormatted: formatFileSize(file.size),
    });

    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleRemoveImage = () => {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
      setObjectUrlToRevoke(null);
    }
    setPreviewUrl(null);
    setFileInfo(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onFileSelect) onFileSelect(null);
    if (onUrlChange) onUrlChange(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleValidateAndSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleValidateAndSelect(e.target.files[0]);
          }
        }}
      />

      {/* Si hay imagen (cargada o en vista previa) */}
      {previewUrl ? (
        <div className={styles.previewBox}>
          <div className={styles.imageFrame}>
            <Image
              src={previewUrl}
              alt="Vista previa"
              width={90}
              height={90}
              className={styles.previewImg}
              unoptimized
            />
          </div>

          <div className={styles.metaInfo}>
            <span className={styles.fileName}>
              {fileInfo ? fileInfo.name : 'Imagen actual del producto'}
            </span>
            <span className={styles.fileSize}>
              {fileInfo ? fileInfo.sizeFormatted : 'Alojada en Supabase Storage'}
            </span>

            <div className={styles.btnRow}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={styles.btnSecondarySmall}
                title="Seleccionar otra imagen"
              >
                <RefreshCw size={12} />
                <span>Reemplazar</span>
              </button>

              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={isUploading}
                className={styles.btnDangerSmall}
                title="Quitar foto"
              >
                <X size={12} />
                <span>Quitar</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Dropzone para seleccionar o arrastrar imagen */
        <div
          className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <div className={styles.uploadingOverlay}>
              <Loader2 size={24} className="animate-spin" />
              <span>Subiendo archivo a Supabase Storage...</span>
            </div>
          ) : (
            <div className={styles.dropzoneContent}>
              <UploadCloud size={28} color="#848484" />
              <div>
                <p className={styles.dropzoneTitle}>
                  <strong>Hacé clic</strong> o arrastrá una foto de producto
                </p>
                <p className={styles.dropzoneHint}>Formatos admitidos: JPG, PNG, WEBP (hasta 5 MB)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className={styles.errorText}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
