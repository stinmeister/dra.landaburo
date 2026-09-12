'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateOperationalAssignments } from '@/app/dashboard/operativo/actions';
import styles from './ConfiguracionOperativa.module.css';

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
}

interface RuleData {
  id: string;
  assigned_profile_id: string | null;
  title: string;
}

interface Props {
  profiles: StaffProfile[];
  stockRule: RuleData | null;
  birthdayRule: RuleData | null;
  giftcardRule: RuleData | null;
}

export default function ConfiguracionOperativa({
  profiles,
  stockRule,
  birthdayRule,
  giftcardRule,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Find defaults if none provided
  const ceci = profiles.find((p) => p.full_name.toLowerCase().includes('ceci'));

  const [birthdayAssignee, setBirthdayAssignee] = useState(
    birthdayRule?.assigned_profile_id || ceci?.id || profiles[0]?.id || ''
  );
  const [giftcardAssignee, setGiftcardAssignee] = useState(
    giftcardRule?.assigned_profile_id || ceci?.id || profiles[0]?.id || ''
  );
  const [stockAssignee, setStockAssignee] = useState(
    stockRule?.assigned_profile_id || ceci?.id || profiles[0]?.id || ''
  );

  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, message: '' });

    startTransition(async () => {
      try {
        const payload: {
          stockAssignee?: string;
          birthdayAssignee?: string;
          giftcardAssignee?: string;
        } = {};

        if (stockRule) payload.stockAssignee = stockAssignee;
        if (birthdayRule) payload.birthdayAssignee = birthdayAssignee;
        if (giftcardRule) payload.giftcardAssignee = giftcardAssignee;

        const res = await updateOperationalAssignments(payload);
        if (res.success) {
          setStatus({
            type: 'success',
            message: res.message || '✓ Responsables actualizados correctamente.',
          });
          router.refresh();
        } else {
          setStatus({
            type: 'error',
            message: res.error || 'Error al guardar asignaciones.',
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al guardar asignaciones.';
        setStatus({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          <span>⚙️</span> Asignación Operativa
        </h2>
        <p className={styles.cardHelper}>
          Configurá quién se encarga de las tareas recurrentes en <code>recurring_task_rules</code>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Cumpleaños */}
        <div className={styles.field}>
          <label htmlFor="birthdayAssignee" className={styles.label}>
            🎂 Saludos de Cumpleaños
          </label>
          <span className={styles.sublabel}>
            Responsable de enviar los saludos de cumpleaños a las pacientes del día.
          </span>
          {!birthdayRule && (
            <div className={styles.pendingBadge}>
              ⚠️ Regla pendiente de DDL en base de datos
            </div>
          )}
          {!birthdayRule && (
            <p className={styles.pendingHelper}>
              La regla aún no existe en <code>recurring_task_rules</code>. Selector deshabilitado para evitar mutaciones silenciosas (R11).
            </p>
          )}
          <select
            id="birthdayAssignee"
            className={styles.select}
            value={birthdayAssignee}
            disabled={!birthdayRule || isPending}
            onChange={(e) => setBirthdayAssignee(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.role})
              </option>
            ))}
          </select>
        </div>

        {/* Gift Cards */}
        <div className={styles.field}>
          <label htmlFor="giftcardAssignee" className={styles.label}>
            🎁 Preparación de Gift Cards Físicas
          </label>
          <span className={styles.sublabel}>
            Responsable del empaque y entrega de tarjetas para retiro en consultorio.
          </span>
          {!giftcardRule && (
            <div className={styles.pendingBadge}>
              ⚠️ Regla pendiente de DDL en base de datos
            </div>
          )}
          {!giftcardRule && (
            <p className={styles.pendingHelper}>
              La regla aún no existe en <code>recurring_task_rules</code>. Selector deshabilitado para evitar mutaciones silenciosas (R11).
            </p>
          )}
          <select
            id="giftcardAssignee"
            className={styles.select}
            value={giftcardAssignee}
            disabled={!giftcardRule || isPending}
            onChange={(e) => setGiftcardAssignee(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.role})
              </option>
            ))}
          </select>
        </div>

        {/* Stock */}
        <div className={styles.field}>
          <label htmlFor="stockAssignee" className={styles.label}>
            📦 Control de Stock & Insumos
          </label>
          <span className={styles.sublabel}>
            Responsable del conteo de productos y alerta de reposición de insumos (viernes).
          </span>
          {!stockRule && (
            <div className={styles.pendingBadge}>
              ⚠️ Regla pendiente de DDL en base de datos
            </div>
          )}
          <select
            id="stockAssignee"
            className={styles.select}
            value={stockAssignee}
            disabled={!stockRule || isPending}
            onChange={(e) => setStockAssignee(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.role})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          {status.type === 'success' && <span className={styles.successMsg}>{status.message}</span>}
          {status.type === 'error' && <span className={styles.errorMsg}>{status.message}</span>}
          <button type="submit" className={styles.submitBtn} disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar Asignaciones'}
          </button>
        </div>
      </form>
    </section>
  );
}
