'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Printer,
  ArrowLeft,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Check,
  TrendingDown,
  TrendingUp,
  Package,
} from 'lucide-react';
import type { StockReportData } from '@/lib/stock/registerMovement';
import styles from './movimientos.module.css';

interface Props {
  initialData: StockReportData;
}

export default function MovimientosClient({ initialData }: Props) {
  const router = useRouter();

  const [startDate, setStartDate] = useState(initialData.startDate);
  const [endDate, setEndDate] = useState(initialData.endDate);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/dashboard/productos/movimientos?from=${startDate}&to=${endDate}`);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const {
    summary,
    movements,
    allBalanced,
    totalInitialStock,
    totalFinalStock,
    totalNetChange,
  } = initialData;

  // Totales consolidados de movimientos en el período
  const totalBaseline = summary.reduce((acc, s) => acc + s.baselineDelta, 0);
  const totalPurchases = summary.reduce((acc, s) => acc + s.purchases, 0);
  const totalOnlineSales = summary.reduce((acc, s) => acc + s.salesOnline, 0);
  const totalCounterSales = summary.reduce((acc, s) => acc + s.salesCounter, 0);
  const totalLosses = summary.reduce((acc, s) => acc + s.losses, 0);
  const totalAdjustments = summary.reduce((acc, s) => acc + s.adjustments, 0);
  const totalRecounts = summary.reduce((acc, s) => acc + s.recountsDelta, 0);

  const formatDateDisplay = (isoStr: string) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Encabezado exclusivo de Impresión (A4) ── */}
      <div className={styles.printOnlyHeader}>
        <h1 className={styles.printClinicName}>Dra. Paula Landaburo — Medicina Estética</h1>
        <h2 className={styles.printReportTitle}>Reporte de Auditoría y Balance de Inventario</h2>
        <div className={styles.printMeta}>
          <span>Período auditado: <strong>{formatDateDisplay(startDate)}</strong> al <strong>{formatDateDisplay(endDate)}</strong></span>
          <span>Generado el: {new Date().toLocaleString('es-AR')}</span>
        </div>
      </div>

      {/* ── Encabezado de Pantalla ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Auditoría de Movimientos de Stock</h1>
          <p className={styles.subtitle}>
            Libro de movimientos inmutable, conciliación fecha a fecha y balance de inventario.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/dashboard/productos" className={styles.btnSecondary}>
            <ArrowLeft size={16} />
            <span>Volver a Productos</span>
          </Link>
          <Link href="/dashboard/productos/recuento" className={styles.btnSecondary}>
            <SlidersHorizontal size={16} />
            <span>Recuento Mensual</span>
          </Link>
          <button type="button" onClick={handlePrint} className={styles.btnPrint}>
            <Printer size={16} />
            <span>Imprimir Reporte</span>
          </button>
        </div>
      </div>

      {/* ── Barra de Filtro de Fechas ── */}
      <form onSubmit={handleApplyFilter} className={styles.filterBar}>
        <div className={styles.filterInputs}>
          <div className={styles.dateField}>
            <span className={styles.dateLabel}>Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={styles.dateInput}
              required
            />
          </div>

          <div className={styles.dateField}>
            <span className={styles.dateLabel}>Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={styles.dateInput}
              required
            />
          </div>

          <button type="submit" className={styles.applyBtn}>
            Actualizar Período
          </button>
        </div>

        <span style={{ fontSize: '0.85rem', color: 'var(--color-gris)' }}>
          Período: <strong>{formatDateDisplay(startDate)}</strong> al <strong>{formatDateDisplay(endDate)}</strong>
        </span>
      </form>

      {/* ── Banner de Conciliación ── */}
      {allBalanced ? (
        <div className={styles.balanceBannerOk}>
          <CheckCircle2 size={24} color="#059669" />
          <div>
            <strong>Inventario 100% Conciliado:</strong> Para todos los {summary.length} productos del catálogo se verifica la ecuación de balance:
            <code style={{ marginLeft: '0.5rem', background: 'rgba(255,255,255,0.6)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
              Stock Inicial + Altas/Base + ∑(Movimientos) === Stock Final
            </code>
          </div>
        </div>
      ) : (
        <div className={styles.balanceBannerDiscrepancy}>
          <AlertTriangle size={24} color="#dc2626" />
          <div>
            <strong>Discrepancia detectada en el balance:</strong> Al menos un producto presenta diferencias entre la suma acumulada de movimientos y el stock de cierre.
          </div>
        </div>
      )}

      {/* ── Tarjetas de Resumen Global ── */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Stock Inicial Período</span>
          <p className={styles.summaryValue}>{totalInitialStock} ud.</p>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Altas / Base (+)</span>
          <p className={`${styles.summaryValue} ${totalBaseline > 0 ? styles.positiveDelta : ''}`}>
            {totalBaseline > 0 ? `+${totalBaseline}` : totalBaseline}
          </p>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Compras (+)</span>
          <p className={`${styles.summaryValue} ${styles.positiveDelta}`}>+{totalPurchases}</p>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Ventas Online (-)</span>
          <p className={`${styles.summaryValue} ${styles.negativeDelta}`}>{totalOnlineSales}</p>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Ventas Mostrador (-)</span>
          <p className={`${styles.summaryValue} ${styles.negativeDelta}`}>{totalCounterSales}</p>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Bajas (-)</span>
          <p className={`${styles.summaryValue} ${styles.negativeDelta}`}>{totalLosses}</p>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Ajustes (±)</span>
          <p className={styles.summaryValue}>{totalAdjustments > 0 ? `+${totalAdjustments}` : totalAdjustments}</p>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Recuentos (Δ)</span>
          <p className={styles.summaryValue}>{totalRecounts > 0 ? `+${totalRecounts}` : totalRecounts}</p>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Stock Final Período</span>
          <p className={styles.summaryValue}>{totalFinalStock} ud.</p>
        </div>
      </div>

      {/* ── 1. Tabla Consolidada por Producto ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Balance Consolidado por Producto</h2>
          <span className={styles.sectionCount}>{summary.length} productos</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className={styles.numCell}>Inicial</th>
                <th className={styles.numCell} title="Altas de producto y líneas de base iniciales (sin impacto en varianza)">Altas / Base</th>
                <th className={styles.numCell}>Compras</th>
                <th className={styles.numCell}>V. Online</th>
                <th className={styles.numCell}>V. Mostrador</th>
                <th className={styles.numCell}>Bajas</th>
                <th className={styles.numCell}>Ajustes</th>
                <th className={styles.numCell} title="Diferencias netas detectadas en recuentos físicos periódicos">Varianza Recuentos</th>
                <th className={styles.numCell}>Var. Neta</th>
                <th className={styles.numCell}>Final</th>
                <th style={{ textAlign: 'center' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.productId}>
                  <td style={{ fontWeight: 500 }}>{row.productName}</td>
                  <td style={{ color: 'var(--color-gris)', fontSize: '0.8rem' }}>{row.category}</td>
                  <td className={styles.numCell}>{row.stockInitial}</td>
                  <td className={`${styles.numCell} ${row.baselineDelta > 0 ? styles.positiveDelta : styles.zeroDelta}`}>
                    {row.baselineDelta > 0 ? `+${row.baselineDelta}` : 0}
                  </td>
                  <td className={`${styles.numCell} ${row.purchases > 0 ? styles.positiveDelta : styles.zeroDelta}`}>
                    {row.purchases > 0 ? `+${row.purchases}` : 0}
                  </td>
                  <td className={`${styles.numCell} ${row.salesOnline < 0 ? styles.negativeDelta : styles.zeroDelta}`}>
                    {row.salesOnline}
                  </td>
                  <td className={`${styles.numCell} ${row.salesCounter < 0 ? styles.negativeDelta : styles.zeroDelta}`}>
                    {row.salesCounter}
                  </td>
                  <td className={`${styles.numCell} ${row.losses < 0 ? styles.negativeDelta : styles.zeroDelta}`}>
                    {row.losses}
                  </td>
                  <td className={`${styles.numCell} ${row.adjustments > 0 ? styles.positiveDelta : row.adjustments < 0 ? styles.negativeDelta : styles.zeroDelta}`}>
                    {row.adjustments > 0 ? `+${row.adjustments}` : row.adjustments}
                  </td>
                  <td className={`${styles.numCell} ${row.recountsDelta > 0 ? styles.positiveDelta : row.recountsDelta < 0 ? styles.negativeDelta : styles.zeroDelta}`}>
                    {row.recountsDelta > 0 ? `+${row.recountsDelta}` : row.recountsDelta}
                  </td>
                  <td className={`${styles.numCell} ${row.netChange > 0 ? styles.positiveDelta : row.netChange < 0 ? styles.negativeDelta : styles.zeroDelta}`}>
                    {row.netChange > 0 ? `+${row.netChange}` : row.netChange}
                  </td>
                  <td className={styles.numCell} style={{ fontWeight: 600 }}>{row.stockFinal}</td>
                  <td style={{ textAlign: 'center' }}>
                    {row.isBalanced ? (
                      <span className={styles.statusBalanced} title="Inicial + Movimientos === Final">
                        <Check size={14} /> OK
                      </span>
                    ) : (
                      <span className={styles.statusDiscrepancy} title="Discrepancia en la suma">
                        ⚠️ Error
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Tabla Detallada Cronológica de Movimientos ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Historial Cronológico de Movimientos en el Período</h2>
          <span className={styles.sectionCount}>{movements.length} movimientos registrados</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Tipo</th>
                <th className={styles.numCell}>Delta</th>
                <th className={styles.numCell}>Stock Antes → Después</th>
                <th>Autor</th>
                <th>Nota / Referencia</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gris)' }}>
                    No se registraron movimientos de stock en el período seleccionado.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  let badgeClass = styles.badgeRecuento;
                  if (m.movement_type === 'compra') badgeClass = styles.badgeCompra;
                  else if (m.movement_type === 'venta_online') badgeClass = styles.badgeVentaOnline;
                  else if (m.movement_type === 'venta_mostrador') badgeClass = styles.badgeVentaMostrador;
                  else if (m.movement_type === 'baja') badgeClass = styles.badgeBaja;
                  else if (m.movement_type === 'ajuste') badgeClass = styles.badgeAjuste;

                  const delta = m.quantity_delta ?? 0;

                  return (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {formatTimestamp(m.created_at)}
                      </td>
                      <td style={{ fontWeight: 500 }}>{m.product_name}</td>
                      <td style={{ color: 'var(--color-gris)', fontSize: '0.8rem' }}>{m.category}</td>
                      <td>
                        <span className={`${styles.badgeType} ${badgeClass}`}>
                          {m.movement_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`${styles.numCell} ${delta > 0 ? styles.positiveDelta : delta < 0 ? styles.negativeDelta : styles.zeroDelta}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </td>
                      <td className={styles.numCell} style={{ fontSize: '0.85rem' }}>
                        {m.stock_before} → <strong>{m.stock_after}</strong>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{m.author_name}</td>
                      <td style={{ color: 'var(--color-gris)', fontSize: '0.8rem' }}>
                        {m.is_annulled && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginRight: '0.5rem',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              border: '1px solid #fde68a',
                              letterSpacing: '0.04em',
                            }}
                          >
                            ANULACIÓN
                          </span>
                        )}
                        {m.is_test && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginRight: '0.5rem',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              border: '1px solid #fecaca',
                              letterSpacing: '0.04em',
                            }}
                          >
                            PRUEBA TÉCNICA
                          </span>
                        )}
                        <span>{m.notes || (m.reference_id ? `Ref: ${m.reference_type} #${m.reference_id}` : '—')}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
