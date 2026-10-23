'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  MinusCircle,
  Database,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import styles from './BotonIngesta.module.css';

interface SourceDetail {
  source: string;
  status: 'ok' | 'partial' | 'error' | 'error_fuente' | 'sin_datos_nuevos' | string;
  rows_processed?: number;
  rows_inserted?: number;
  rows_in_review?: number;
  file_date?: string;
  source_file?: string;
  error_details?: string;
  error_since?: string;
  [key: string]: unknown;
}

interface IngestRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  triggered_by_name: string | null;
  trigger_source: string;
  n8n_execution_id: string | null;
  status: 'running' | 'ok' | 'partial' | 'error' | 'abandonada' | string;
  summary: SourceDetail[] | Record<string, unknown> | null;
}

/**
 * Cuatro estados explícitos requeridos para la lectura de `public.obtener_ultimo_ingest_run()`:
 * - 'empty'       -> NULL ("todavía no se corrió ninguna ingesta")
 * - 'has_run'     -> fila + status (el resumen de la corrida)
 * - 'forbidden'   -> error 42501 ("no sos admin")
 * - 'unavailable' -> cualquier otro error de base con el código crudo visible (ej. PGRST202)
 */
type RunLoadState = 'loading' | 'empty' | 'has_run' | 'forbidden' | 'unavailable';

function formatDate(isoStr: string | null | undefined): string {
  if (!isoStr) return '--:--';
  try {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(d);
  } catch {
    return isoStr;
  }
}

export default function BotonIngesta() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [loadState, setLoadState] = useState<RunLoadState>('loading');
  const [lastRun, setLastRun] = useState<IngestRun | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unavailableCode, setUnavailableCode] = useState<string | null>(null);
  const [unavailableDetail, setUnavailableDetail] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const fetchRunStatus = useCallback(
    async (
      runId?: string
    ): Promise<{
      state: RunLoadState;
      run: IngestRun | null;
      code?: string;
      errorDetail?: string;
    }> => {
      try {
        const url = runId
          ? `/api/admin/run-ingesta?run_id=${encodeURIComponent(runId)}`
          : '/api/admin/run-ingesta';
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));

        // Estado 3: error 42501 -> no sos admin
        if (
          res.status === 403 ||
          res.status === 401 ||
          data?.code === '42501' ||
          data?.state === 'forbidden'
        ) {
          return {
            state: 'forbidden',
            run: null,
            code: data?.code || '42501',
            errorDetail: data?.error || 'No sos admin (42501)',
          };
        }

        // Estado 4: cualquier otro error de base -> unavailable con código crudo visible
        if (!res.ok || data?.state === 'unavailable') {
          return {
            state: 'unavailable',
            run: null,
            code: data?.code || `HTTP_${res.status}`,
            errorDetail:
              data?.error || 'No se pudo consultar el estado de la última ingesta en la base.',
          };
        }

        // Estado 1: NULL -> "todavía no se corrió ninguna ingesta"
        if (!data?.run || data?.state === 'empty') {
          return {
            state: 'empty',
            run: null,
          };
        }

        // Estado 2: fila + status -> el resumen de la corrida
        return {
          state: 'has_run',
          run: data.run as IngestRun,
        };
      } catch (err) {
        console.error('[BotonIngesta] Error al consultar corrida:', err);
        return {
          state: 'unavailable',
          run: null,
          code: 'NETWORK_ERROR',
          errorDetail: 'Error de red al consultar última ingesta.',
        };
      }
    },
    []
  );

  const startPolling = useCallback(
    (runId: string) => {
      stopPolling();
      setIsRunning(true);

      pollIntervalRef.current = setInterval(async () => {
        const result = await fetchRunStatus(runId);
        if (result.state === 'forbidden') {
          setLoadState('forbidden');
          setLastRun(null);
          stopPolling();
          setIsRunning(false);
          return;
        }
        if (result.state === 'unavailable') {
          setLoadState('unavailable');
          setUnavailableCode(result.code || 'DB_ERROR');
          setUnavailableDetail(result.errorDetail || null);
          return;
        }
        if (result.state === 'has_run' && result.run) {
          setLoadState('has_run');
          setLastRun(result.run);
          if (result.run.status !== 'running') {
            stopPolling();
            setIsRunning(false);
            router.refresh(); // Actualiza los números del dashboard
          }
        }
      }, 2500);
    },
    [fetchRunStatus, stopPolling, router]
  );

  // Al montar, consultar la última corrida vía RPC obtener_ultimo_ingest_run
  useEffect(() => {
    let mounted = true;
    fetchRunStatus().then((result) => {
      if (!mounted) return;
      setLoadState(result.state);
      setLastRun(result.run);
      setUnavailableCode(result.code || null);
      setUnavailableDetail(result.errorDetail || null);

      if (result.state === 'has_run' && result.run?.status === 'running') {
        startPolling(result.run.id);
      }
    });

    return () => {
      mounted = false;
      stopPolling();
    };
  }, [fetchRunStatus, startPolling, stopPolling]);

  const handleTriggerIngesta = async () => {
    setErrorMsg(null);
    setIsRunning(true);

    try {
      const res = await fetch('/api/admin/run-ingesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403 || data?.code === '42501') {
        setLoadState('forbidden');
        setLastRun(null);
        setIsRunning(false);
        return;
      }

      if (res.status === 409) {
        // Candado activo (< 15 minutos)
        setErrorMsg(
          `Ya existe una corrida en curso iniciada el ${formatDate(data.started_at)}.`
        );
        if (data.run_id) {
          startPolling(data.run_id);
        } else {
          setIsRunning(false);
        }
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || 'Ocurrió un error al iniciar la ingesta.');
        setIsRunning(false);
        return;
      }

      if (data.run_id) {
        // Actualizar inmediatamente el estado visual a corrida en curso
        setLoadState('has_run');
        setLastRun({
          id: data.run_id,
          started_at: data.started_at || new Date().toISOString(),
          finished_at: null,
          triggered_by_name: null,
          trigger_source: 'boton_web',
          n8n_execution_id: null,
          status: data.status || 'running',
          summary: null,
        });
        startPolling(data.run_id);
      }
    } catch {
      setErrorMsg('Error de conexión al solicitar la corrida.');
      setIsRunning(false);
    }
  };

  // Normalizar lista de fuentes desde el summary jsonb
  const sources: SourceDetail[] = [];
  if (lastRun?.summary) {
    if (Array.isArray(lastRun.summary)) {
      sources.push(...(lastRun.summary as SourceDetail[]));
    } else if (
      typeof lastRun.summary === 'object' &&
      Array.isArray((lastRun.summary as Record<string, unknown>).sources)
    ) {
      sources.push(
        ...((lastRun.summary as Record<string, unknown>).sources as SourceDetail[])
      );
    } else if (typeof lastRun.summary === 'object') {
      // Si viniera como clave-valor por fuente: { pagos: {...}, citas: {...} }
      for (const [key, val] of Object.entries(lastRun.summary)) {
        if (typeof val === 'object' && val !== null) {
          sources.push({ source: key, ...(val as Record<string, unknown>) } as SourceDetail);
        }
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <div className={styles.iconBadge}>
            <Database size={18} />
          </div>
          <div>
            <h3 className={styles.mainTitle}>Ingesta de Calu (WF-00)</h3>
            <p className={styles.subTitle}>
              Sincronización automatizada de caja, agenda y pacientes
            </p>
          </div>
        </div>

        <div className={styles.actionsArea}>
          <button
            type="button"
            onClick={handleTriggerIngesta}
            disabled={isRunning || loadState === 'forbidden'}
            className={`${styles.runBtn} ${isRunning ? styles.runBtnRunning : ''}`}
          >
            {isRunning ? (
              <>
                <RefreshCw size={15} className={styles.spinIcon} />
                <span>Procesando ingesta...</span>
              </>
            ) : (
              <>
                <Play size={15} />
                <span>Ejecutar Ingesta</span>
              </>
            )}
          </button>

          {loadState === 'has_run' && lastRun && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-gris)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.4rem',
              }}
              title={expanded ? 'Ocultar detalles' : 'Ver detalles'}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Banner de error o conflicto al disparar POST */}
      {errorMsg && (
        <div className={styles.errorBanner}>
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className={styles.errorCloseBtn}
          >
            ✕
          </button>
        </div>
      )}

      {/* Notificación de ejecución en vivo */}
      {isRunning && (
        <div className={styles.runningNotice}>
          <RefreshCw size={16} className={styles.spinIcon} />
          <span>
            Ejecución en segundo plano activa (bloqueo de seguridad de 15 minutos aplicado).
            Esperando confirmación de n8n...
          </span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ESTADO 1: NULL (empty) -> "Todavía no se corrió ninguna ingesta"
          ═══════════════════════════════════════════════════════════════════════ */}
      {loadState === 'empty' && !isRunning && (
        <div className={styles.emptyStateBox} data-testid="ingest-state-empty">
          <div className={styles.summaryHeader}>
            <span className={styles.summaryTitle}>Estado de ingesta</span>
            <span className={`${styles.statusBadge} ${styles.badgeAbandonada}`}>
              <MinusCircle size={12} /> Sin corridas registradas
            </span>
          </div>
          <p className={styles.emptyStateText}>
            Todavía no se corrió ninguna ingesta.
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ESTADO 3: error 42501 (forbidden) -> "No sos admin"
          ═══════════════════════════════════════════════════════════════════════ */}
      {loadState === 'forbidden' && (
        <div className={styles.forbiddenStateBox} data-testid="ingest-state-forbidden">
          <ShieldAlert size={18} />
          <div>
            <strong>No sos admin (código 42501):</strong> Acceso denegado para consultar o
            ejecutar corridas de ingesta.
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ESTADO 4: unavailable -> Error de base (distinto de 42501) con código crudo visible
          ═══════════════════════════════════════════════════════════════════════ */}
      {loadState === 'unavailable' && (
        <div className={styles.unavailableStateBox} data-testid="ingest-state-unavailable">
          <div className={styles.summaryHeader}>
            <span className={styles.summaryTitle}>Estado de ingesta no disponible</span>
            <span className={`${styles.statusBadge} ${styles.badgeError}`}>
              <AlertTriangle size={12} /> Código: {unavailableCode || 'DB_ERROR'}
            </span>
          </div>
          <p className={styles.unavailableStateText}>
            No se pudo consultar la última corrida en la base de datos (estado{' '}
            <code>unavailable</code> · código crudo: <code>{unavailableCode || 'DB_ERROR'}</code>
            {unavailableDetail ? ` — ${unavailableDetail}` : ''}).
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ESTADO 2: fila + status (has_run) -> El resumen de la corrida
          ═══════════════════════════════════════════════════════════════════════ */}
      {loadState === 'has_run' && lastRun && expanded && (
        <div className={styles.summaryContainer} data-testid="ingest-state-has-run">
          <div className={styles.summaryHeader}>
            <span className={styles.summaryTitle}>Última corrida registrada</span>
            <div>
              {lastRun.status === 'ok' && (
                <span className={`${styles.statusBadge} ${styles.badgeOk}`}>
                  <CheckCircle2 size={12} /> Correcta
                </span>
              )}
              {lastRun.status === 'running' && (
                <span className={`${styles.statusBadge} ${styles.badgeRunning}`}>
                  <Clock size={12} /> En ejecución
                </span>
              )}
              {lastRun.status === 'error' && (
                <span className={`${styles.statusBadge} ${styles.badgeError}`}>
                  <AlertCircle size={12} /> Error general
                </span>
              )}
              {lastRun.status === 'abandonada' && (
                <span className={`${styles.statusBadge} ${styles.badgeAbandonada}`}>
                  <Clock size={12} /> Abandonada (&gt;15 min)
                </span>
              )}
              {lastRun.status === 'partial' && (
                <span className={`${styles.statusBadge} ${styles.badgeRunning}`}>
                  Parcial
                </span>
              )}
            </div>
          </div>

          <div className={styles.metaRow}>
            <span>
              <strong>Iniciada:</strong> {formatDate(lastRun.started_at)}
            </span>
            {lastRun.finished_at && (
              <span>
                <strong>Finalizada:</strong> {formatDate(lastRun.finished_at)}
              </span>
            )}
            {lastRun.triggered_by_name && (
              <span>
                <strong>Por:</strong> {lastRun.triggered_by_name}
              </span>
            )}
            <span>
              <strong>Origen:</strong> {lastRun.trigger_source}
            </span>
          </div>

          {/* Grilla de fuentes reportadas por WF-00 */}
          {sources.length > 0 && (
            <div className={styles.sourcesGrid}>
              {sources.map((item, idx) => {
                const isError =
                  item.status === 'error_fuente' || item.status === 'error';
                const isNeutral = item.status === 'sin_datos_nuevos';
                const isOk = item.status === 'ok' || item.status === 'success';

                let cardClass = styles.sourceNeutral;
                if (isError) cardClass = styles.sourceError;
                else if (isOk) cardClass = styles.sourceOk;

                return (
                  <div key={item.source || idx} className={`${styles.sourceCard} ${cardClass}`}>
                    <div className={styles.sourceHeader}>
                      <span>{item.source}</span>
                      <span>
                        {isError && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <AlertCircle size={14} /> Problema
                          </span>
                        )}
                        {isNeutral && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <MinusCircle size={14} /> Sin datos
                          </span>
                        )}
                        {isOk && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={14} /> OK
                          </span>
                        )}
                      </span>
                    </div>

                    <div className={styles.sourceDetails}>
                      {isError ? (
                        <div>
                          <strong>Fallo en la fuente:</strong>{' '}
                          {item.error_since && `(reportado desde ${item.error_since}) `}
                          {item.error_details || 'Error al procesar el archivo origen.'}
                        </div>
                      ) : isNeutral ? (
                        <div>
                          No se encontraron nuevos registros.{' '}
                          {item.source_file && `Archivo: ${item.source_file}. `}
                          {item.file_date && `Fecha archivo: ${item.file_date}`}
                        </div>
                      ) : (
                        <div>
                          {item.rows_processed ?? item.rows_inserted ?? 0} fila(s) procesadas
                          {item.rows_in_review ? `, ${item.rows_in_review} en revisión` : ''}.
                          {item.file_date ? ` Archivo: ${item.file_date}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
