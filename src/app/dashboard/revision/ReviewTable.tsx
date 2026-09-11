'use client';

import React, { useState, useTransition } from 'react';
import type { IngestReviewRecord } from '@/lib/ingest-review';
import { updateReviewStatusAction } from './actions';
import styles from './page.module.css';

interface Props {
  initialItems: IngestReviewRecord[];
}

export default function ReviewTable({ initialItems }: Props) {
  const [items, setItems] = useState<IngestReviewRecord[]>(initialItems);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'patients' | 'payments'>('all');
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (id: string, newStatus: 'resolved' | 'dismissed') => {
    startTransition(async () => {
      try {
        await updateReviewStatusAction(id, newStatus);
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: newStatus } : it))
        );
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error al actualizar');
      }
    });
  };

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = items.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
    return true;
  });

  return (
    <>
      <div className={styles.filterBar}>
        <button
          type="button"
          onClick={() => setStatusFilter('pending')}
          className={`${styles.filterBtn} ${statusFilter === 'pending' ? styles.filterBtnActive : ''}`}
        >
          Pendientes ({items.filter((i) => i.status === 'pending').length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('resolved')}
          className={`${styles.filterBtn} ${statusFilter === 'resolved' ? styles.filterBtnActive : ''}`}
        >
          Resueltos ({items.filter((i) => i.status === 'resolved').length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('dismissed')}
          className={`${styles.filterBtn} ${statusFilter === 'dismissed' ? styles.filterBtnActive : ''}`}
        >
          Descartados ({items.filter((i) => i.status === 'dismissed').length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
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

      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            No hay registros para los filtros seleccionados.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Origen</th>
                <th>Identificador</th>
                <th>Motivo de Revisión</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
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
                    <div className={styles.reasonText}>{item.reason}</div>
                    <button
                      type="button"
                      onClick={() => togglePayload(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#c5a47e',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '0.75rem',
                        textDecoration: 'underline',
                      }}
                    >
                      {expandedPayloads[item.id] ? 'Ocultar datos raw' : 'Ver datos raw'}
                    </button>
                    {expandedPayloads[item.id] && (
                      <pre className={styles.payloadPre}>
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: '#718096' }}>
                      {new Date(item.created_at).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
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
                            onClick={() => handleStatusChange(item.id, 'resolved')}
                            className={styles.actionBtnResolve}
                          >
                            Resolver
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleStatusChange(item.id, 'dismissed')}
                            className={styles.actionBtnDismiss}
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
