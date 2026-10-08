'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, FileText, AlertCircle, Eye, X } from 'lucide-react';
import styles from '../page.module.css';

interface AuditLog {
  id: string;
  occurred_at: string;
  actor_id: string | null;
  actor_name: string;
  action: 'eliminado' | 'archivado' | 'restaurado';
  entity_type: string;
  entity_id: string;
  entity_name: string;
  reason?: string | null;
  snapshot?: Record<string, any>;
}

interface Props {
  initialLogs: AuditLog[];
  tablePending: boolean;
  error?: string;
}

export default function AuditoriaClient({ initialLogs, tablePending, error }: Props) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<{ name: string; data: Record<string, any> } | null>(null);

  const formatArgDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'eliminado':
        return (
          <span style={{
            display: 'inline-block',
            padding: '0.2rem 0.55rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderRadius: '4px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          }}>
            Eliminado
          </span>
        );
      case 'archivado':
        return (
          <span style={{
            display: 'inline-block',
            padding: '0.2rem 0.55rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderRadius: '4px',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fde68a',
          }}>
            Archivado
          </span>
        );
      case 'restaurado':
        return (
          <span style={{
            display: 'inline-block',
            padding: '0.2rem 0.55rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderRadius: '4px',
            backgroundColor: '#dcfce7',
            color: '#166534',
            border: '1px solid #bbf7d0',
          }}>
            Restaurado
          </span>
        );
      default:
        return <span>{action}</span>;
    }
  };

  const getEntityBadge = (entityType: string) => {
    return (
      <span style={{
        display: 'inline-block',
        padding: '0.15rem 0.45rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        borderRadius: '3px',
        backgroundColor: '#f3f4f6',
        color: '#374151',
        border: '1px solid #e5e7eb',
        textTransform: 'capitalize',
      }}>
        {entityType}
      </span>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Link
              href="/dashboard/productos"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.85rem',
                color: 'var(--color-gris)',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={16} />
              Volver a Productos
            </Link>
          </div>
          <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert size={26} color="#991b1b" />
            Auditoría de Bajas y Archivados
          </h1>
          <p className={styles.subtitle}>
            Registro inmutable de eliminaciones físicas y archivados de productos y tratamientos (deletion_audit).
          </p>
        </div>
      </div>

      {tablePending && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}>
          <AlertCircle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#92400e', fontSize: '0.9rem' }}>
              DDL de deletion_audit pendiente de ejecución en Supabase
            </strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: '#78350f', lineHeight: 1.5 }}>
              Agustín está por ejecutar el DDL en el SQL Editor. Por seguridad y diseño, las eliminaciones físicas
              están bloqueadas en el backend hasta que la tabla exista, garantizando que ninguna entidad se borre sin auditoría inmutable.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #f87171',
          borderRadius: '8px',
          padding: '1rem',
          color: '#991b1b',
          fontSize: '0.875rem',
        }}>
          ⚠️ Error al consultar auditoría: {error}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '150px' }}>Fecha y Hora</th>
              <th style={{ width: '160px' }}>Autor</th>
              <th style={{ width: '110px' }}>Acción</th>
              <th style={{ width: '110px' }}>Tipo</th>
              <th>Entidad / Elemento</th>
              <th>Motivo</th>
              <th style={{ textAlign: 'center', width: '100px' }}>Snapshot</th>
            </tr>
          </thead>
          <tbody>
            {initialLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  {tablePending
                    ? 'Esperando creación de la tabla deletion_audit en Supabase.'
                    : 'No hay registros de eliminaciones o archivados en el sistema.'}
                </td>
              </tr>
            ) : (
              initialLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {formatArgDate(log.occurred_at)}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.actor_name}</span>
                  </td>
                  <td>{getActionBadge(log.action)}</td>
                  <td>{getEntityBadge(log.entity_type)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.entity_name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-gris)', fontFamily: 'monospace' }}>
                      ID: {log.entity_id}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.825rem', color: log.reason ? 'inherit' : 'var(--color-gris)' }}>
                    {log.reason || 'Sin motivo especificado'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {log.snapshot && Object.keys(log.snapshot).length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedSnapshot({ name: log.entity_name, data: log.snapshot || {} })}
                        style={{
                          background: 'none',
                          border: '1px solid var(--color-gris-claro)',
                          borderRadius: '4px',
                          padding: '0.3rem 0.6rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.75rem',
                          color: 'var(--color-negro)',
                        }}
                        title="Ver datos del snapshot previo al borrado"
                      >
                        <Eye size={13} />
                        Ver JSON
                      </button>
                    ) : (
                      <span style={{ color: 'var(--color-gris)', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal para ver Snapshot JSON ── */}
      {selectedSnapshot && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--color-gris-claro)',
            }}>
              <div>
                <strong style={{ fontSize: '1rem', color: 'var(--color-negro)' }}>
                  Snapshot previo: {selectedSnapshot.name}
                </strong>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--color-gris)' }}>
                  Estado íntegro del registro antes de eliminarse o archivarse
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSnapshot(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  color: 'var(--color-gris)',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
              <pre style={{
                margin: 0,
                backgroundColor: '#f8fafc',
                padding: '1rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                lineHeight: 1.5,
                color: '#1e293b',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {JSON.stringify(selectedSnapshot.data, null, 2)}
              </pre>
            </div>
            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--color-gris-claro)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button
                type="button"
                onClick={() => setSelectedSnapshot(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-negro)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
