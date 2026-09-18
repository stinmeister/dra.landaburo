'use client';

import React, { useState, useTransition, useMemo } from 'react';
import type { IngestReviewRecord } from '@/lib/ingest-review';
import { updateReviewStatusAction, bulkUpdateReviewStatusAction } from './actions';
import styles from './page.module.css';

interface Props {
  initialItems: IngestReviewRecord[];
}

type ReasonCategory =
  | 'all'
  | 'moneda'
  | 'multi_service'
  | 'estado'
  | 'paciente'
  | 'profesional'
  | 'pago'
  | 'duplicado'
  | 'otro';

interface ParsedReason {
  category: ReasonCategory;
  categoryLabel: string;
  title: string;
  actionGuidance: string;
  technicalCode: string;
  paymentId?: string;
  amountDisplay?: string;
  paymentMethodDisplay?: string;
  serviceDisplay?: string;
  professionalDisplay?: string;
  patientDisplay?: string;
}

function parseReason(reason: string, payload: Record<string, unknown>): ParsedReason {
  const rLower = (reason || '').toLowerCase();
  const monto = payload.monto_pagado_ars as number | undefined;
  const medioPago = payload.medio_pago as string | undefined;
  const servicio = payload.servicio as string | undefined;
  const profesional = payload.profesional as string | undefined;
  const dni = payload.dni as string | undefined;
  const paymentId = (payload.payment_id as string | undefined) || (payload.paymentId as string | undefined);

  // 1. Moneda USD
  if (rLower.includes('moneda_usd')) {
    return {
      category: 'moneda',
      categoryLabel: 'Moneda USD',
      title: 'Revisar el monto — parece estar en dólares',
      actionGuidance: 'Verificar la cotización del día o confirmar si corresponde registrar en USD.',
      technicalCode: 'moneda_usd',
      paymentId,
      amountDisplay: monto != null ? `$${monto} USD` : undefined,
      paymentMethodDisplay: medioPago || 'Efectivo USD',
      serviceDisplay: servicio,
    };
  }

  // 2. Monto ambiguo / seña / saldo parcial
  if (rLower.includes('monto_rango_ambiguo') || rLower.includes('monto_sospechoso') || rLower.includes('monto_parcial_seña')) {
    return {
      category: 'moneda',
      categoryLabel: 'Saldo o seña',
      title: 'Cobro registrado — posible saldo parcial o seña',
      actionGuidance: 'El monto en pesos ya ingresó a la facturación. Si la paciente abona el resto más adelante, el cobro se actualizará automáticamente.',
      technicalCode: 'monto_rango_ambiguo',
      paymentId,
      amountDisplay: monto != null ? `$${monto.toLocaleString('es-AR')}` : undefined,
      paymentMethodDisplay: medioPago,
      serviceDisplay: servicio,
    };
  }

  // 3. Multi-servicio
  if (rLower.includes('is_multi_service')) {
    return {
      category: 'multi_service',
      categoryLabel: 'Multi-servicio',
      title: 'Varios tratamientos en un mismo cobro',
      actionGuidance: 'El cobro ya ingresó al total de facturación. No requiere división manual.',
      technicalCode: 'is_multi_service',
      paymentId,
      serviceDisplay: servicio,
      amountDisplay: monto != null ? `$${monto.toLocaleString('es-AR')} ARS` : undefined,
    };
  }

  // 4. Estado de cita
  if (rLower.includes('estado_desconocido') || rLower.includes('cita eliminada')) {
    return {
      category: 'estado',
      categoryLabel: 'Estado de cita',
      title: 'Estado de la cita no reconocido',
      actionGuidance: 'Verificar si la cita fue atendida y facturada o si corresponde descartarla.',
      technicalCode: 'estado_desconocido',
      paymentId,
      serviceDisplay: `Estado: "${payload.estado || 'Desconocido'}"`,
    };
  }

  // 5. Sin paciente o ambiguo
  if (rLower.includes('sin_paciente') || rLower.includes('ambiguous_ref')) {
    return {
      category: 'paciente',
      categoryLabel: 'Paciente por vincular',
      title: 'Cobro registrado — falta vincular paciente en el padrón',
      actionGuidance: 'El cobro ya ingresó a la facturación del consultorio. Falta asociar la paciente cuando se actualice el padrón o buscar por DNI.',
      technicalCode: rLower.includes('ambiguous_ref') ? 'ambiguous_ref' : 'sin_paciente',
      paymentId,
      patientDisplay: dni ? `DNI/Identificador: ${dni}` : 'Sin identificador',
    };
  }

  // 6. Profesional
  if (rLower.includes('sin_professional')) {
    return {
      category: 'profesional',
      categoryLabel: 'Falta profesional',
      title: 'Cobro registrado — falta asignar profesional',
      actionGuidance: 'El cobro ya ingresó a la facturación del consultorio. Falta asignar la médica o cosmiatra para el cálculo de comisiones.',
      technicalCode: 'sin_professional',
      paymentId,
      professionalDisplay: profesional ? `"${profesional}"` : 'Campo vacío',
    };
  }

  // 7. Medio de pago
  if (rLower.includes('metodo_pago') || rLower.includes('medio_pago')) {
    return {
      category: 'pago',
      categoryLabel: 'Medio de pago',
      title: 'Medio de pago no reconocido',
      actionGuidance: 'Verificar el método de cobro en el comprobante (Efectivo, Débito, Transferencia, MP).',
      technicalCode: 'medio_pago_desconocido',
      paymentMethodDisplay: medioPago || 'No especificado',
    };
  }

  // 8. Posible duplicado
  if (rLower.includes('posible_duplicado') || rLower.includes('duplicado')) {
    return {
      category: 'duplicado',
      categoryLabel: 'Posible duplicado',
      title: 'Posible cobro duplicado en ventana solapada',
      actionGuidance: 'Comparar con el cobro ya registrado para confirmar si fue un cobro doble real o una duplicación.',
      technicalCode: 'posible_duplicado',
      amountDisplay: monto != null ? `$${monto.toLocaleString('es-AR')}` : undefined,
    };
  }

  // 9. Monto negativo
  if (rLower.includes('monto_negativo')) {
    return {
      category: 'otro',
      categoryLabel: 'Monto negativo',
      title: 'Monto negativo en registro de origen',
      actionGuidance: 'Verificar si corresponde a una devolución o corrección.',
      technicalCode: 'monto_negativo',
      amountDisplay: monto != null ? `$${monto}` : undefined,
    };
  }

  // Fallback
  return {
    category: 'otro',
    categoryLabel: 'Otros',
    title: reason,
    actionGuidance: 'Revisar datos crudos para evaluar la incidencia.',
    technicalCode: 'otro',
  };
}

function parsePaymentDateFromPayload(payload: Record<string, unknown>, createdAt: string): { display: string; timestamp: number } {
  const clave = payload.clave_unica as string | undefined;
  const fecha = payload.fecha as string | undefined;

  if (clave) {
    if (clave.includes('|')) {
      const parts = clave.split('|');
      if (parts.length >= 2) {
        const dt = new Date(parts[1].trim());
        if (!isNaN(dt.getTime())) {
          return {
            display: dt.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            timestamp: dt.getTime(),
          };
        }
      }
    }
  }

  if (fecha) {
    const parts = fecha.trim().split(' ')[0].split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00-03:00`);
      if (!isNaN(dt.getTime())) {
        return {
          display: dt.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }),
          timestamp: dt.getTime(),
        };
      }
    }
  }

  const created = new Date(createdAt);
  return {
    display: created.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }),
    timestamp: created.getTime(),
  };
}

export default function ReviewTable({ initialItems }: Props) {
  const [items, setItems] = useState<IngestReviewRecord[]>(initialItems);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'patients' | 'payments'>('all');
  const [selectedCategory, setSelectedCategory] = useState<ReasonCategory>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'payment_date' | 'created_at'>('payment_date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  // Categorizar items
  const parsedItems = useMemo(() => {
    return items.map((item) => {
      const parsed = parseReason(item.reason, item.payload);
      const paymentDate = parsePaymentDateFromPayload(item.payload, item.created_at);
      return {
        ...item,
        parsed,
        paymentDate,
      };
    });
  }, [items]);

  // Conteo por categoría sobre los items con el statusFilter actual
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      moneda: 0,
      multi_service: 0,
      estado: 0,
      paciente: 0,
      profesional: 0,
      pago: 0,
      duplicado: 0,
      otro: 0,
    };

    parsedItems.forEach((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return;
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return;
      counts.all++;
      counts[item.parsed.category] = (counts[item.parsed.category] || 0) + 1;
    });

    return counts;
  }, [parsedItems, statusFilter, sourceFilter]);

  // Filtrado y ordenamiento
  const filtered = useMemo(() => {
    return parsedItems
      .filter((item) => {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
        if (selectedCategory !== 'all' && item.parsed.category !== selectedCategory) return false;
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'payment_date') {
          diff = a.paymentDate.timestamp - b.paymentDate.timestamp;
        } else {
          diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return sortOrder === 'desc' ? -diff : diff;
      });
  }, [parsedItems, statusFilter, sourceFilter, selectedCategory, sortBy, sortOrder]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((it) => it.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSingleStatusChange = (id: string, newStatus: 'resolved' | 'dismissed') => {
    startTransition(async () => {
      try {
        await updateReviewStatusAction(id, newStatus);
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: newStatus } : it))
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error al actualizar');
      }
    });
  };

  const handleBulkStatusChange = (newStatus: 'resolved' | 'dismissed') => {
    if (selectedIds.size === 0) return;
    const idsToUpdate = Array.from(selectedIds);

    startTransition(async () => {
      try {
        await bulkUpdateReviewStatusAction(idsToUpdate, newStatus);
        setItems((prev) =>
          prev.map((it) => (selectedIds.has(it.id) ? { ...it, status: newStatus } : it))
        );
        setSelectedIds(new Set());
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error al actualizar');
      }
    });
  };

  const handleCategoryBulkChange = (newStatus: 'resolved' | 'dismissed') => {
    const idsInCurrentView = filtered.filter((i) => i.status === 'pending').map((i) => i.id);
    if (idsInCurrentView.length === 0) return;

    if (!confirm(`¿Estás seguro de marcar como "${newStatus === 'resolved' ? 'Resueltos' : 'Descartados'}" los ${idsInCurrentView.length} registros del filtro actual?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await bulkUpdateReviewStatusAction(idsInCurrentView, newStatus);
        const setOfIds = new Set(idsInCurrentView);
        setItems((prev) =>
          prev.map((it) => (setOfIds.has(it.id) ? { ...it, status: newStatus } : it))
        );
        setSelectedIds(new Set());
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error al actualizar');
      }
    });
  };

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isAllSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <>
      {/* ── 1. Filtros de Estado y Origen ── */}
      <div className={styles.filterBar}>
        <button
          type="button"
          onClick={() => { setStatusFilter('pending'); setSelectedIds(new Set()); }}
          className={`${styles.filterBtn} ${statusFilter === 'pending' ? styles.filterBtnActive : ''}`}
        >
          Pendientes ({items.filter((i) => i.status === 'pending').length})
        </button>
        <button
          type="button"
          onClick={() => { setStatusFilter('resolved'); setSelectedIds(new Set()); }}
          className={`${styles.filterBtn} ${statusFilter === 'resolved' ? styles.filterBtnActive : ''}`}
        >
          Resueltos ({items.filter((i) => i.status === 'resolved').length})
        </button>
        <button
          type="button"
          onClick={() => { setStatusFilter('dismissed'); setSelectedIds(new Set()); }}
          className={`${styles.filterBtn} ${statusFilter === 'dismissed' ? styles.filterBtnActive : ''}`}
        >
          Descartados ({items.filter((i) => i.status === 'dismissed').length})
        </button>
        <button
          type="button"
          onClick={() => { setStatusFilter('all'); setSelectedIds(new Set()); }}
          className={`${styles.filterBtn} ${statusFilter === 'all' ? styles.filterBtnActive : ''}`}
        >
          Todos ({items.length})
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            className={`${styles.filterBtn} ${sourceFilter === 'all' ? styles.filterBtnActive : ''}`}
          >
            Todos los orígenes
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('patients')}
            className={`${styles.filterBtn} ${sourceFilter === 'patients' ? styles.filterBtnActive : ''}`}
          >
            Pacientes
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('payments')}
            className={`${styles.filterBtn} ${sourceFilter === 'payments' ? styles.filterBtnActive : ''}`}
          >
            Pagos
          </button>
        </div>
      </div>

      {/* ── 2. Agrupación por Motivo con Conteos ── */}
      <div className={styles.categoryGroupBar}>
        <span className={styles.categoryGroupLabel}>Agrupar por motivo:</span>
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`${styles.categoryChip} ${selectedCategory === 'all' ? styles.categoryChipActive : ''}`}
        >
          Todos <span className={styles.categoryCountBadge}>{categoryCounts.all}</span>
        </button>
        {categoryCounts.moneda > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('moneda')}
            className={`${styles.categoryChip} ${selectedCategory === 'moneda' ? styles.categoryChipActive : ''}`}
          >
            💵 Moneda USD <span className={styles.categoryCountBadge}>{categoryCounts.moneda}</span>
          </button>
        )}
        {categoryCounts.multi_service > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('multi_service')}
            className={`${styles.categoryChip} ${selectedCategory === 'multi_service' ? styles.categoryChipActive : ''}`}
          >
            📋 Multi-servicio <span className={styles.categoryCountBadge}>{categoryCounts.multi_service}</span>
          </button>
        )}
        {categoryCounts.estado > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('estado')}
            className={`${styles.categoryChip} ${selectedCategory === 'estado' ? styles.categoryChipActive : ''}`}
          >
            📅 Estado de cita <span className={styles.categoryCountBadge}>{categoryCounts.estado}</span>
          </button>
        )}
        {categoryCounts.paciente > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('paciente')}
            className={`${styles.categoryChip} ${selectedCategory === 'paciente' ? styles.categoryChipActive : ''}`}
          >
            👤 Sin paciente <span className={styles.categoryCountBadge}>{categoryCounts.paciente}</span>
          </button>
        )}
        {categoryCounts.profesional > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('profesional')}
            className={`${styles.categoryChip} ${selectedCategory === 'profesional' ? styles.categoryChipActive : ''}`}
          >
            🩺 Falta profesional <span className={styles.categoryCountBadge}>{categoryCounts.profesional}</span>
          </button>
        )}
        {categoryCounts.pago > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('pago')}
            className={`${styles.categoryChip} ${selectedCategory === 'pago' ? styles.categoryChipActive : ''}`}
          >
            💳 Medio de pago <span className={styles.categoryCountBadge}>{categoryCounts.pago}</span>
          </button>
        )}
        {categoryCounts.duplicado > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('duplicado')}
            className={`${styles.categoryChip} ${selectedCategory === 'duplicado' ? styles.categoryChipActive : ''}`}
          >
            ⚠️ Duplicados <span className={styles.categoryCountBadge}>{categoryCounts.duplicado}</span>
          </button>
        )}
        {categoryCounts.otro > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('otro')}
            className={`${styles.categoryChip} ${selectedCategory === 'otro' ? styles.categoryChipActive : ''}`}
          >
            🔍 Otros <span className={styles.categoryCountBadge}>{categoryCounts.otro}</span>
          </button>
        )}

        {selectedCategory !== 'all' && statusFilter === 'pending' && filtered.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleCategoryBulkChange('resolved')}
              className={styles.bulkBtnResolve}
            >
              Resolver grupo ({filtered.length})
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleCategoryBulkChange('dismissed')}
              className={styles.bulkBtnDismiss}
              style={{ color: '#4a5568', borderColor: 'rgba(210, 211, 211, 0.5)' }}
            >
              Descartar grupo ({filtered.length})
            </button>
          </div>
        )}
      </div>

      {/* ── 3. Barra flotante de acciones masivas cuando hay selección ── */}
      {selectedIds.size > 0 && (
        <div className={styles.bulkActionBar}>
          <div className={styles.bulkInfo}>
            <span>✓ {selectedIds.size} registro{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className={styles.bulkBtnClear}
            >
              Deseleccionar todos
            </button>
          </div>
          <div className={styles.bulkButtons}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleBulkStatusChange('resolved')}
              className={styles.bulkBtnResolve}
            >
              Resolver seleccionados ({selectedIds.size})
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleBulkStatusChange('dismissed')}
              className={styles.bulkBtnDismiss}
            >
              Descartar seleccionados ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Tabla de Incidencias ── */}
      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            No hay registros para los filtros seleccionados.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className={styles.checkbox}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th>Origen</th>
                <th>Identificador</th>
                <th>Incidencia & Datos del Cobro</th>
                <th
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (sortBy === 'payment_date') {
                      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setSortBy('payment_date');
                      setSortOrder('desc');
                    }
                  }}
                  title="Clic para ordenar por fecha de cobro"
                >
                  Fecha del Cobro {sortBy === 'payment_date' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const { parsed, paymentDate } = item;

                return (
                  <tr key={item.id} className={isSelected ? styles.selectedRow : ''}>
                    <td className={styles.checkboxCell}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(item.id)}
                        className={styles.checkbox}
                      />
                    </td>
                    <td>
                      <span
                        className={`${styles.badgeSource} ${
                          item.source === 'patients'
                            ? styles.badgeSourcePatients
                            : styles.badgeSourcePayments
                        }`}
                      >
                        {item.source}
                      </span>
                    </td>
                    <td>
                      <div className={styles.identifierText}>
                        {item.record_identifier || '—'}
                      </div>
                    </td>
                    <td>
                      <div className={styles.reasonContainer}>
                        <div className={styles.reasonTitle}>{parsed.title}</div>
                        
                        <div className={styles.reasonDetails}>
                          {parsed.amountDisplay && (
                            <span className={`${styles.reasonMetaPill} ${styles.reasonMetaPillHighlight}`}>
                              Monto: {parsed.amountDisplay}
                            </span>
                          )}
                          {parsed.paymentMethodDisplay && (
                            <span className={styles.reasonMetaPill}>
                              Medio: {parsed.paymentMethodDisplay}
                            </span>
                          )}
                          {parsed.serviceDisplay && (
                            <span className={styles.reasonMetaPill}>
                              {parsed.serviceDisplay}
                            </span>
                          )}
                          {parsed.professionalDisplay && (
                            <span className={styles.reasonMetaPill}>
                              Prof: {parsed.professionalDisplay}
                            </span>
                          )}
                          {parsed.patientDisplay && (
                            <span className={styles.reasonMetaPill}>
                              {parsed.patientDisplay}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '2px' }}>
                          👉 {parsed.actionGuidance}
                        </div>

                        {parsed.paymentId && (
                          <div style={{ marginTop: '4px' }}>
                            <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#15803d', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                              ✓ Cobro ingresado en base de datos (ID: {parsed.paymentId.slice(0, 8)})
                            </span>
                          </div>
                        )}

                        <div>
                          <button
                            type="button"
                            onClick={() => togglePayload(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#c5a47e',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '0.73rem',
                              textDecoration: 'underline',
                              marginTop: '4px',
                            }}
                          >
                            {expandedPayloads[item.id] ? 'Ocultar datos raw' : 'Ver datos raw'}
                          </button>
                          {expandedPayloads[item.id] && (
                            <pre className={styles.payloadPre}>
                              {JSON.stringify(item.payload, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.dateCellText}>
                        <span className={styles.paymentDateText}>{paymentDate.display}</span>
                        <span className={styles.detectedDateText}>
                          Detectado: {new Date(item.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          item.status === 'pending'
                            ? styles.statusPending
                            : item.status === 'resolved'
                            ? styles.statusResolved
                            : styles.statusDismissed
                        }
                      >
                        {item.status === 'pending'
                          ? 'Pendiente'
                          : item.status === 'resolved'
                          ? 'Resuelto'
                          : 'Descartado'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        {item.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleSingleStatusChange(item.id, 'resolved')}
                              className={styles.actionBtnResolve}
                              title="Marcar como resuelto"
                            >
                              Resolver
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleSingleStatusChange(item.id, 'dismissed')}
                              className={styles.actionBtnDismiss}
                              title="Descartar incidencia"
                            >
                              Descartar
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
                            Sin acciones
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
