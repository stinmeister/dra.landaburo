'use client';

import { useState, useTransition } from 'react';
import { toggleKioskAdmissionStatus } from '@/app/dashboard/operativo/actions';
import styles from './KioskAdmissionsList.module.css';

export interface KioskAdmission {
  id: string;
  created_at: string;
  full_name: string;
  dni: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  attribution_channel: string | null;
  referral_name: string | null;
  interests: any;
  status: 'nuevo' | 'atendido';
}

interface Props {
  initialAdmissions: KioskAdmission[];
}

export default function KioskAdmissionsList({ initialAdmissions }: Props) {
  const [admissions, setAdmissions] = useState<KioskAdmission[]>(initialAdmissions);
  const [isPending, startTransition] = useTransition();

  const unreadCount = admissions.filter((a) => a.status === 'nuevo').length;

  const handleToggle = (id: string, currentStatus: 'nuevo' | 'atendido') => {
    const newStatus = currentStatus === 'nuevo' ? 'atendido' : 'nuevo';
    startTransition(async () => {
      try {
        await toggleKioskAdmissionStatus(id, newStatus);
        setAdmissions((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
        );
      } catch (err: any) {
        alert(err.message || 'Error al actualizar estado');
      }
    });
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>📱 Recepción & Tótem Kiosco</h2>
          {unreadCount > 0 ? (
            <span className={styles.badgeNew}>{unreadCount} nuevo{unreadCount !== 1 ? 's' : ''}</span>
          ) : (
            <span className={styles.badgeAllDone}>Al día</span>
          )}
        </div>
        <span className={styles.headerNote}>Registro en consultorio</span>
      </div>

      <p className={styles.helper}>
        Pacientes que completaron el check-in en la tablet del consultorio. Marcá como &quot;Atendido&quot; tras recibir al paciente.
      </p>

      {admissions.length === 0 ? (
        <p className={styles.empty}>No hay registros recientes del kiosco.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Llegada</th>
                <th>Paciente</th>
                <th>Contacto</th>
                <th>Interés / Motivo</th>
                <th>Canal</th>
                <th>Estado</th>
                <th className={styles.thRight}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {admissions.map((adm) => {
                const isNew = adm.status === 'nuevo';
                return (
                  <tr key={adm.id} className={isNew ? styles.trNew : styles.tr}>
                    <td className={styles.tdDate}>{formatDateTime(adm.created_at)}</td>
                    <td className={styles.tdName}>
                      <strong>{adm.full_name}</strong>
                      {adm.dni && <span className={styles.subText}>DNI: {adm.dni}</span>}
                    </td>
                    <td className={styles.tdContact}>
                      {adm.phone && <div>📞 {adm.phone}</div>}
                      {adm.email && <div className={styles.subText}>✉️ {adm.email}</div>}
                    </td>
                    <td className={styles.tdInterests}>
                      {Array.isArray(adm.interests)
                        ? adm.interests.join(', ')
                        : typeof adm.interests === 'string'
                        ? adm.interests
                        : '—'}
                    </td>
                    <td className={styles.tdChannel}>
                      {adm.attribution_channel || '—'}
                    </td>
                    <td>
                      <span className={isNew ? styles.statusNew : styles.statusDone}>
                        {isNew ? 'Nuevo' : 'Atendido'}
                      </span>
                    </td>
                    <td className={styles.tdRight}>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggle(adm.id, adm.status)}
                        className={isNew ? styles.btnMarkDone : styles.btnMarkNew}
                      >
                        {isNew ? 'Marcar Atendido' : 'Marcar Nuevo'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
