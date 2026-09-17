'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Banknote,
  Clock,
  User,
  Activity,
} from 'lucide-react';
import styles from './page.module.css';

export interface PaymentItem {
  id: string;
  payment_date: string;
  amount_ars: number | null;
  amount_usd: number | null;
  currency: string;
  payment_method: string;
  notes: string | null;
  external_id: string | null;
  patient_name: string;
  patient_dni: string | null;
  professional_name: string;
}

export interface ReviewItem {
  id: string;
  record_identifier: string | null;
  reason: string;
  created_at: string;
}

export interface MethodTotal {
  method: string;
  label: string;
  amount_ars: number;
  amount_usd: number;
  count: number;
  isCash?: boolean;
}

interface Props {
  currentDate: string;
  todayDate: string;
  formattedDisplayDate: string;
  totalArs: number;
  totalUsd: number;
  paidPayments: PaymentItem[];
  zeroPayments: PaymentItem[];
  methodTotals: MethodTotal[];
  pendingReviews: ReviewItem[];
}

function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(d);
  } catch {
    return '--:--';
  }
}

export default function CierreDiarioClient({
  currentDate,
  todayDate,
  formattedDisplayDate,
  totalArs,
  totalUsd,
  paidPayments,
  zeroPayments,
  methodTotals,
  pendingReviews,
}: Props) {
  const router = useRouter();
  const [showZeros, setShowZeros] = useState(false);

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    router.push(`/dashboard/ejecutivo?tab=cierre-diario&fecha=${newDate}`);
  };

  const handleOffsetDay = (offsetDays: number) => {
    const [y, m, d] = currentDate.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d + offsetDays));
    const nextIso = dateObj.toISOString().slice(0, 10);
    handleDateChange(nextIso);
  };

  const isToday = currentDate === todayDate;

  return (
    <div className={styles.container}>
      {/* ── Encabezado ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Cierre de Caja Diario</h1>
        <p className={styles.subtitle}>
          Control y conciliación diaria de cobros de recepción
        </p>
      </div>

      {/* ── Selector de Fecha y Navegación ── */}
      <div className={styles.dateNavCard}>
        <div className={styles.dateNavControls}>
          <button
            type="button"
            onClick={() => handleOffsetDay(-1)}
            className={styles.navArrowBtn}
            title="Día anterior"
          >
            <ChevronLeft size={16} />
            <span>Ayer</span>
          </button>

          <div className={styles.dateInputWrapper}>
            <Calendar size={16} className={styles.dateIcon} />
            <input
              type="date"
              value={currentDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className={styles.dateInput}
            />
          </div>

          <button
            type="button"
            onClick={() => handleOffsetDay(1)}
            className={styles.navArrowBtn}
            title="Día siguiente"
          >
            <span>Mañana</span>
            <ChevronRight size={16} />
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => handleDateChange(todayDate)}
              className={styles.todayBtn}
              title="Volver al día actual"
            >
              Ir a Hoy
            </button>
          )}
        </div>

        <div className={styles.dateDisplayLarge}>
          {formattedDisplayDate} {isToday ? '(Hoy)' : ''}
        </div>
      </div>

      {/* ── Alerta si hay cobros en revisión del día ── */}
      {pendingReviews.length > 0 && (
        <div className={styles.alertCard}>
          <div className={styles.alertContent}>
            <AlertTriangle size={22} className={styles.alertIcon} />
            <div>
              <p className={styles.alertTitle}>
                {pendingReviews.length} cobro{pendingReviews.length !== 1 ? 's' : ''} del día en revisión pendiente
              </p>
              <p className={styles.alertDesc}>
                Hay operaciones que requieren verificación de moneda o profesional antes de sumarse al cierre.
              </p>
            </div>
          </div>
          <Link href="/dashboard/ejecutivo?tab=revision" className={styles.alertBtn}>
            <span>Ver en Revisión</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* ── Tarjeta Hero: Total Facturado del Día ── */}
      <div className={styles.heroGrid}>
        <div className={styles.totalHeroCard}>
          <span className={styles.heroLabel}>Total Cobrado en el Día</span>
          <div className={styles.heroAmountRow}>
            <span className={styles.heroTotal}>{formatARS(totalArs)}</span>
            {totalUsd > 0 && (
              <span className={styles.heroTotalUsd}>USD {totalUsd.toLocaleString('es-AR')}</span>
            )}
          </div>
          <span className={styles.heroMeta}>
            {paidPayments.length} cobro{paidPayments.length !== 1 ? 's' : ''} facturado{paidPayments.length !== 1 ? 's' : ''} registrado{paidPayments.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Desglose por Medio de Pago ── */}
      <div className={styles.breakdownSection}>
        <h2 className={styles.sectionTitle}>Desglose para Arqueo de Caja</h2>
        <div className={styles.methodsGrid}>
          {methodTotals.map((m) => (
            <div
              key={m.method}
              className={`${styles.methodCard} ${m.isCash ? styles.methodCardCash : ''}`}
            >
              <div className={styles.methodCardHeader}>
                <span className={styles.methodName}>{m.label}</span>
                {m.isCash && <span className={styles.cashTag}>En Cajón</span>}
              </div>
              <span className={styles.methodAmount}>{formatARS(m.amount_ars)}</span>
              {m.amount_usd > 0 && (
                <span style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>
                  USD {m.amount_usd}
                </span>
              )}
              <span className={styles.methodCount}>
                {m.count} cobro{m.count !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
          {methodTotals.length === 0 && (
            <div className={styles.emptyState}>
              No se registraron cobros para esta fecha.
            </div>
          )}
        </div>
      </div>

      {/* ── Lista de Cobros del Día ── */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.sectionTitle}>Detalle de Cobros</h2>
          <span className={styles.tableCount}>
            {paidPayments.length} registro{paidPayments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {paidPayments.length === 0 ? (
          <div className={styles.emptyState}>
            No hay cobros registrados en esta jornada.
          </div>
        ) : (
          <>
            {/* Tabla para Desktop / Tablets */}
            <div className={styles.desktopTableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Paciente</th>
                    <th>Tratamiento / Servicio</th>
                    <th>Medio de Pago</th>
                    <th>Profesional</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {paidPayments.map((p) => (
                    <tr key={p.id}>
                      <td className={styles.timeCell}>{formatTime(p.payment_date)}</td>
                      <td>
                        <div className={styles.patientCell}>
                          <span className={styles.patientName}>{p.patient_name}</span>
                          {p.patient_dni && (
                            <span className={styles.patientDni}>DNI: {p.patient_dni}</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.serviceCell}>
                        <span className={styles.serviceText}>{p.notes || 'Tratamiento'}</span>
                      </td>
                      <td>
                        <span
                          className={`${styles.methodBadge} ${
                            p.payment_method === 'efectivo' ? styles.badgeEfectivo : ''
                          }`}
                        >
                          {p.payment_method.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-gris)', fontSize: '0.85rem' }}>
                        {p.professional_name}
                      </td>
                      <td className={styles.amountCell}>
                        {p.amount_ars != null && p.amount_ars > 0 ? (
                          formatARS(p.amount_ars)
                        ) : p.amount_usd ? (
                          <span className={styles.amountUsd}>USD {p.amount_usd}</span>
                        ) : (
                          '$0'
                        )}
                        {p.amount_ars && p.amount_usd && (
                          <span className={styles.amountUsd}>USD {p.amount_usd}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista Cards para Teléfono Celular (Mobile First) */}
            <div className={styles.mobileList}>
              {paidPayments.map((p) => (
                <div key={p.id} className={styles.mobileCard}>
                  <div className={styles.mobileCardTop}>
                    <span className={styles.mobilePatient}>{p.patient_name}</span>
                    <span className={styles.mobileAmount}>
                      {p.amount_ars != null && p.amount_ars > 0
                        ? formatARS(p.amount_ars)
                        : `USD ${p.amount_usd}`}
                    </span>
                  </div>
                  <div className={styles.mobileDetails}>
                    <span>{p.notes || 'Tratamiento'}</span>
                    <span
                      className={`${styles.methodBadge} ${
                        p.payment_method === 'efectivo' ? styles.badgeEfectivo : ''
                      }`}
                    >
                      {p.payment_method.replace('_', ' ')}
                    </span>
                  </div>
                  <div className={styles.mobileDetails}>
                    <span>Hora: {formatTime(p.payment_date)}</span>
                    <span>{p.professional_name}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Atenciones sin cobro / $0 del día ── */}
      <div className={styles.zeroCard}>
        <button
          type="button"
          onClick={() => setShowZeros(!showZeros)}
          className={styles.zeroToggleHeader}
        >
          <span className={styles.zeroTitle}>
            <Activity size={16} />
            <span>Atenciones sin cobro registrado ({zeroPayments.length})</span>
            <span className={styles.zeroBadge}>Controles / Bonificados</span>
          </span>
          {showZeros ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showZeros && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            {zeroPayments.length === 0 ? (
              <p style={{ color: 'var(--color-gris)', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                No se registraron atenciones con monto $0 en esta jornada.
              </p>
            ) : (
              <div className={styles.desktopTableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Paciente</th>
                      <th>Concepto / Procedimiento</th>
                      <th>Profesional</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zeroPayments.map((z) => (
                      <tr key={z.id}>
                        <td className={styles.timeCell}>{formatTime(z.payment_date)}</td>
                        <td>
                          <div className={styles.patientCell}>
                            <span className={styles.patientName}>{z.patient_name}</span>
                            {z.patient_dni && (
                              <span className={styles.patientDni}>DNI: {z.patient_dni}</span>
                            )}
                          </div>
                        </td>
                        <td>{z.notes || 'Consulta / Control'}</td>
                        <td style={{ color: 'var(--color-gris)', fontSize: '0.85rem' }}>
                          {z.professional_name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
