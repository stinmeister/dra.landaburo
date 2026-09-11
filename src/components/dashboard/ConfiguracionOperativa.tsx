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

interface Props {
  profiles: StaffProfile[];
  initialBirthdayAssignee?: string;
  initialGiftcardAssignee?: string;
  initialStockAssignee?: string;
}

export default function ConfiguracionOperativa({
  profiles,
  initialBirthdayAssignee = '',
  initialGiftcardAssignee = '',
  initialStockAssignee = '',
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Find defaults if none provided
  const ceci = profiles.find((p) => p.full_name.toLowerCase().includes('ceci'));
  const laura = profiles.find((p) => p.full_name.toLowerCase().includes('laura'));

  const [birthdayAssignee, setBirthdayAssignee] = useState(
    initialBirthdayAssignee || ceci?.id || profiles[0]?.id || ''
  );
  const [giftcardAssignee, setGiftcardAssignee] = useState(
    initialGiftcardAssignee || ceci?.id || profiles[0]?.id || ''
  );
  const [stockAssignee, setStockAssignee] = useState(
    initialStockAssignee || ceci?.id || profiles[0]?.id || ''
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
        const res = await updateOperationalAssignments({
          birthdayAssignee,
          giftcardAssignee,
          stockAssignee,
        });
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
          Configurá quién se encarga por defecto de las tareas automáticas del consultorio.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="birthdayAssignee" className={styles.label}>
            🎂 Saludos de Cumpleaños
          </label>
          <span className={styles.sublabel}>
            Responsable de enviar los saludos de cumpleaños a las pacientes del día.
          </span>
          <select
            id="birthdayAssignee"
            className={styles.select}
            value={birthdayAssignee}
            onChange={(e) => setBirthdayAssignee(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.role})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="giftcardAssignee" className={styles.label}>
            🎁 Preparación de Gift Cards Físicas
          </label>
          <span className={styles.sublabel}>
            Responsable del empaque y entrega de tarjetas para retiro en consultorio.
          </span>
          <select
            id="giftcardAssignee"
            className={styles.select}
            value={giftcardAssignee}
            onChange={(e) => setGiftcardAssignee(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.role})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="stockAssignee" className={styles.label}>
            📦 Control de Stock & Insumos
          </label>
          <span className={styles.sublabel}>
            Responsable del conteo de productos y alerta de reposición de insumos.
          </span>
          <select
            id="stockAssignee"
            className={styles.select}
            value={stockAssignee}
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
