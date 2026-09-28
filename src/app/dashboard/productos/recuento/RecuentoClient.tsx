'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Search,
  History,
  Check,
} from 'lucide-react';
import { submitMonthlyCount } from '../actions';
import { type MonthlyCountInput } from '@/lib/stock/registerMovement';
import styles from './recuento.module.css';

interface ProductItem {
  id: string;
  name: string;
  category: string;
  brand_type: string;
  stock_quantity: number;
}

interface Props {
  products: ProductItem[];
  categories: string[];
}

export default function RecuentoClient({ products, categories }: Props) {
  const router = useRouter();

  // Estados de recuento
  const [counts, setCounts] = useState<Record<string, number | ''>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtrado de productos en pantalla
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Cambiar cantidad contada
  const handleCountChange = (id: string, val: string) => {
    if (val === '') {
      setCounts((prev) => ({ ...prev, [id]: '' }));
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 0) {
        setCounts((prev) => ({ ...prev, [id]: num }));
      }
    }
  };

  // Cambiar nota
  const handleNoteChange = (id: string, note: string) => {
    setNotes((prev) => ({ ...prev, [id]: note }));
  };

  // Copiar stock del sistema a todos los contados
  const handleAutoFill = () => {
    const newCounts: Record<string, number> = {};
    products.forEach((p) => {
      newCounts[p.id] = p.stock_quantity ?? 0;
    });
    setCounts(newCounts);
  };

  // Métricas en vivo
  const metrics = useMemo(() => {
    let countedTotal = 0;
    let surplusCount = 0;
    let deficitCount = 0;
    let zeroCount = 0;

    products.forEach((p) => {
      const val = counts[p.id];
      if (typeof val === 'number') {
        countedTotal++;
        const delta = val - (p.stock_quantity ?? 0);
        if (delta > 0) surplusCount++;
        else if (delta < 0) deficitCount++;
        else zeroCount++;
      }
    });

    return {
      total: products.length,
      counted: countedTotal,
      surplus: surplusCount,
      deficit: deficitCount,
      zero: zeroCount,
    };
  }, [products, counts]);

  // Enviar recuento
  const handleSubmit = async () => {
    setStatusMessage(null);

    const payload: MonthlyCountInput[] = [];
    products.forEach((p) => {
      const val = counts[p.id];
      if (typeof val === 'number') {
        payload.push({
          productId: p.id,
          countedQty: val,
          notes: notes[p.id]?.trim() || `Recuento mensual — Sistema: ${p.stock_quantity} → Físico: ${val}`,
        });
      }
    });

    if (payload.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Por favor ingresá al menos una cantidad contada antes de confirmar el recuento.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitMonthlyCount(payload);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `¡Recuento mensual registrado exitosamente! Se actualizaron ${payload.length} productos y se crearon los movimientos correspondientes en el histórico.`,
        });
        router.refresh();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Ocurrió un error al procesar el recuento.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Error de conexión al enviar el recuento.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Encabezado ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Recuento Físico Mensual</h1>
          <p className={styles.subtitle}>
            Ingresá las cantidades físicas relevadas en consultorio. Cada producto ajustará su stock y registrará un movimiento inmutable de tipo recuento.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/dashboard/productos" className={styles.backBtn}>
            <ArrowLeft size={16} />
            <span>Volver a Productos</span>
          </Link>
          <Link href="/dashboard/productos/movimientos" className={styles.backBtn}>
            <History size={16} />
            <span>Ver Movimientos</span>
          </Link>
        </div>
      </div>

      {/* ── Alertas de estado ── */}
      {statusMessage && (
        <div className={statusMessage.type === 'success' ? styles.alertSuccess : styles.alertError}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span>{statusMessage.text}</span>
          </div>
          {statusMessage.type === 'success' && (
            <Link
              href="/dashboard/productos/movimientos"
              style={{ fontWeight: 600, color: 'inherit', textDecoration: 'underline' }}
            >
              Ver reporte de auditoría →
            </Link>
          )}
        </div>
      )}

      {/* ── Resumen de Métricas ── */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Productos</span>
          <p className={styles.metricValue}>{metrics.total}</p>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Relevados / Contados</span>
          <p className={`${styles.metricValue} ${styles.metricValueBlue}`}>
            {metrics.counted} / {metrics.total}
          </p>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Con Sobrante (+)</span>
          <p className={`${styles.metricValue} ${styles.metricValueGreen}`}>{metrics.surplus}</p>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Con Faltante (-)</span>
          <p className={`${styles.metricValue} ${styles.metricValueRed}`}>{metrics.deficit}</p>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Sin Variación (OK)</span>
          <p className={styles.metricValue}>{metrics.zero}</p>
        </div>
      </div>

      {/* ── Barra de herramientas / Filtros ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarFilters}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Buscar producto por nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.categorySelect}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleAutoFill}
          className={styles.autoFillBtn}
          title="Completa las cantidades contadas con el stock actual del sistema"
        >
          <Copy size={14} />
          <span>Copiar stock del sistema</span>
        </button>
      </div>

      {/* ── Tabla de Recuento ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th style={{ textAlign: 'center' }}>Stock Sistema</th>
              <th style={{ textAlign: 'center' }}>Físico Contado</th>
              <th style={{ textAlign: 'center' }}>Diferencia</th>
              <th>Observación / Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gris)' }}>
                  No se encontraron productos con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const countedVal = counts[p.id];
                const hasCount = typeof countedVal === 'number';
                const systemVal = p.stock_quantity ?? 0;
                const delta = hasCount ? (countedVal as number) - systemVal : 0;

                return (
                  <tr key={p.id}>
                    <td>
                      <span className={styles.productName}>{p.name}</span>
                      {p.brand_type && (
                        <span className={styles.brandBadge}>{p.brand_type}</span>
                      )}
                    </td>

                    <td style={{ color: 'var(--color-gris)' }}>{p.category}</td>

                    <td style={{ textAlign: 'center' }}>
                      <span className={styles.systemStock}>{systemVal} ud.</span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="—"
                        value={countedVal ?? ''}
                        onChange={(e) => handleCountChange(p.id, e.target.value)}
                        className={styles.countInput}
                      />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {!hasCount ? (
                        <span style={{ color: 'var(--color-gris)', fontSize: '0.8rem' }}>Sin relevar</span>
                      ) : delta === 0 ? (
                        <span className={`${styles.deltaBadge} ${styles.deltaZero}`}>0 (Sin cambio)</span>
                      ) : delta > 0 ? (
                        <span className={`${styles.deltaBadge} ${styles.deltaPositive}`}>+{delta} (Sobrante)</span>
                      ) : (
                        <span className={`${styles.deltaBadge} ${styles.deltaNegative}`}>{delta} (Faltante)</span>
                      )}
                    </td>

                    <td>
                      <input
                        type="text"
                        placeholder={
                          hasCount && delta !== 0
                            ? 'Motivo de diferencia (opcional)'
                            : 'Observación opcional...'
                        }
                        value={notes[p.id] || ''}
                        onChange={(e) => handleNoteChange(p.id, e.target.value)}
                        className={styles.notesInput}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Botón de Confirmación ── */}
      <div className={styles.footerActions}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || metrics.counted === 0}
          className={styles.submitBtn}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className={styles.spinner} />
              <span>Registrando recuento...</span>
            </>
          ) : (
            <>
              <Check size={18} />
              <span>Confirmar Recuento ({metrics.counted} productos)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
