// Dashboard Ejecutivo — Reestructurado con pestañas (Resumen, Cierre Diario, Revisión).
// Control de permisos estricto del lado del servidor (R6): cada pestaña evalúa su propio permiso.
// Server Component: queries run at request time, no client-side loading states.

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserSections } from '@/lib/permissions';
import { getPendingReviewCount, getReviewItems } from '@/lib/ingest-review';
import PeriodSelector from '@/components/dashboard/PeriodSelector';
import type { PeriodOption } from '@/components/dashboard/PeriodSelector';
import EjecutivoTabs, { TabItem } from './EjecutivoTabs';
import CierreDiarioClient from '../cierre-diario/CierreDiarioClient';
import { getCierreDiarioData } from '../cierre-diario/getCierreDiarioData';
import ReviewTable from '../revision/ReviewTable';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard Ejecutivo | Dra. Landaburo',
};

// Types matching the DB schema exactly — avoids using `any`
type Profile = {
  id: string;
  role: string;
};

type Payment = {
  id: string;
  amount_ars: number;
  amount_usd: number | null;
  currency: string;
  payment_method: string;
  commission_amount_ars: number;
  payment_date: string;
  notes: string | null;
  patients: { full_name: string } | null;
  profiles: { full_name: string } | null;
};

function formatARS(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(isoString));
}

function isProductSale(notes: string | null): boolean {
  const n = (notes || '').toLowerCase();
  return (
    n.includes('venta de producto') ||
    n.includes('venta de productos') ||
    n.includes('[venta-producto]')
  );
}

export default async function EjecutivoPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string; fecha?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/dashboard/ejecutivo');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  const role = profile?.role ?? '';
  if (!role || role === 'paciente') redirect('/portal/paciente');

  // Guard server-side: matriz de permisos unificada
  const perms = await getUserSections(user.id, role);
  const canEjecutivo = perms.allowed.has('ejecutivo');
  const canCierreDiario = perms.allowed.has('cierre-diario');
  const canRevision = perms.allowed.has('revision');

  if (!canEjecutivo && !canCierreDiario && !canRevision) {
    redirect('/dashboard/sin-acceso');
  }

  const pendingReviewCount = await getPendingReviewCount();

  // Construir pestañas disponibles según los permisos del usuario
  const availableTabs: TabItem[] = [];
  if (canEjecutivo) {
    availableTabs.push({
      key: 'resumen',
      label: 'Resumen Mensual',
      href: '/dashboard/ejecutivo?tab=resumen',
    });
  }
  if (canCierreDiario) {
    availableTabs.push({
      key: 'cierre-diario',
      label: 'Cierre del Día',
      href: '/dashboard/ejecutivo?tab=cierre-diario',
    });
  }
  if (canRevision) {
    availableTabs.push({
      key: 'revision',
      label: 'Revisión',
      href: '/dashboard/ejecutivo?tab=revision',
      badge: pendingReviewCount,
    });
  }

  // Determinar pestaña activa (default: primera permitida)
  const resolvedParams = await searchParams;
  const requestedTab = resolvedParams?.tab?.trim();
  let activeTab: string = availableTabs[0].key;

  if (requestedTab === 'resumen' && canEjecutivo) {
    activeTab = 'resumen';
  } else if (requestedTab === 'cierre-diario' && canCierreDiario) {
    activeTab = 'cierre-diario';
  } else if (requestedTab === 'revision' && canRevision) {
    activeTab = 'revision';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PESTAÑA: CIERRE DEL DÍA
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeTab === 'cierre-diario') {
    const cierreData = await getCierreDiarioData(resolvedParams?.fecha);
    return (
      <div className={styles.page}>
        <EjecutivoTabs tabs={availableTabs} activeTab={activeTab} />
        <CierreDiarioClient
          currentDate={cierreData.currentDate}
          todayDate={cierreData.todayDate}
          formattedDisplayDate={cierreData.formattedDisplayDate}
          totalArs={cierreData.totalArs}
          totalUsd={cierreData.totalUsd}
          paidPayments={cierreData.paidPayments}
          zeroPayments={cierreData.zeroPayments}
          methodTotals={cierreData.methodTotals}
          pendingReviews={cierreData.pendingReviews}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PESTAÑA: REVISIÓN DE REGISTROS
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeTab === 'revision') {
    const items = await getReviewItems({ limit: 200 });
    return (
      <div className={styles.page}>
        <EjecutivoTabs tabs={availableTabs} activeTab={activeTab} />
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>Registros para Revisión</h1>
            <p className={styles.period}>
              Los cobros ya ingresaron a la facturación del consultorio. En esta pantalla se señalan datos pendientes de completar (asignar profesional, vincular paciente en el padrón o auditar saldos).
            </p>
          </div>
        </header>
        <ReviewTable initialItems={items} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PESTAÑA: RESUMEN MENSUAL (EJECUTIVO)
  // ═══════════════════════════════════════════════════════════════════════════
  const adminClient = createAdminClient();

  // 1. Total payments en la DB
  const { count: totalPaymentsCount } = await adminClient
    .from('payments')
    .select('id', { count: 'exact', head: true });
  const totalInDb = totalPaymentsCount ?? 0;

  // 2. Último cobro para mes por defecto
  const { data: latestPayment } = await adminClient
    .from('payments')
    .select('payment_date')
    .order('payment_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Meses con datos
  const { data: dateRows } = await adminClient
    .from('payments')
    .select('payment_date');

  const monthsWithData = new Set<string>();
  (dateRows ?? []).forEach((r) => {
    if (r.payment_date) {
      monthsWithData.add(r.payment_date.slice(0, 7)); // 'YYYY-MM'
    }
  });

  // 4. Período seleccionado
  const requestedPeriod = resolvedParams?.period;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let selectedPeriod: string;
  if (requestedPeriod && /^\d{4}-\d{2}$/.test(requestedPeriod)) {
    selectedPeriod = requestedPeriod;
  } else if (latestPayment?.payment_date) {
    selectedPeriod = latestPayment.payment_date.slice(0, 7);
  } else {
    selectedPeriod = currentMonthKey;
  }

  const [sYear, sMonth] = selectedPeriod.split('-').map(Number);
  const sMonthPad = String(sMonth).padStart(2, '0');
  const lastDay = new Date(sYear, sMonth, 0).getDate();
  const lastDayPad = String(lastDay).padStart(2, '0');

  const monthStart = `${sYear}-${sMonthPad}-01T00:00:00-03:00`;
  const monthEnd = `${sYear}-${sMonthPad}-${lastDayPad}T23:59:59.999-03:00`;

  // Opciones de período
  const defaultMonths = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
  const allPeriodKeys = Array.from(new Set([...defaultMonths, ...monthsWithData, selectedPeriod])).sort();

  const periodOptions: PeriodOption[] = allPeriodKeys.map((key) => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1, 15);
    const rawName = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(d);
    const label = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    return {
      value: key,
      label: key === currentMonthKey ? `${label} (actual)` : label,
      hasData: monthsWithData.has(key),
    };
  });

  const selectedDisplayDate = new Date(sYear, sMonth - 1, 15);
  const rawMonthLabel = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(selectedDisplayDate);
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);

  let latestMonthLabel = '';
  if (latestPayment?.payment_date) {
    const lDate = new Date(latestPayment.payment_date);
    const lRaw = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(lDate);
    latestMonthLabel = lRaw.charAt(0).toUpperCase() + lRaw.slice(1);
  }

  // 1. Consulta agregada completa del mes (sin límite) para métricas exactas (Punto B)
  const { data: monthTotalsRaw } = await adminClient
    .from('payments')
    .select('id, amount_ars, amount_usd, currency, commission_amount_ars, notes')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd);

  const monthRows = monthTotalsRaw || [];

  // Clasificación de cobros del mes
  const paidRows = monthRows.filter((p) => Number(p.amount_ars) > 0 || Number(p.amount_usd ?? 0) > 0);
  const zeroRows = monthRows.filter((p) => Number(p.amount_ars) === 0 && Number(p.amount_usd ?? 0) === 0);

  // Separación de Tratamientos vs Venta de Productos (Punto E)
  const productRows = paidRows.filter((p) => isProductSale(p.notes));
  const treatmentRows = paidRows.filter((p) => !isProductSale(p.notes));

  const totalTreatmentsARS = treatmentRows.reduce((sum, p) => sum + Number(p.amount_ars || 0), 0);
  const totalProductsARS = productRows.reduce((sum, p) => sum + Number(p.amount_ars || 0), 0);
  const totalARS = totalTreatmentsARS + totalProductsARS;

  // Facturación USD sin mezclar con pesos (Punto C)
  const usdRows = monthRows.filter(
    (p) => p.currency === 'USD' || (p.amount_usd != null && Number(p.amount_usd) > 0)
  );
  const totalUSD = usdRows.reduce((sum, p) => sum + Number(p.amount_usd ?? 0), 0);

  // Comisiones
  const totalMercedesCommission = monthRows.reduce(
    (sum, p) => sum + Number(p.commission_amount_ars || 0),
    0
  );

  // Facturación menos comisiones (Punto F)
  const facturacionMenosComisiones = totalARS - totalMercedesCommission;

  // 2. Consulta de cobros del mes para la tabla paginada (Punto B)
  const { data: paymentsRaw, error: paymentsError } = await adminClient
    .from('payments')
    .select(`
      id,
      amount_ars,
      amount_usd,
      currency,
      payment_method,
      commission_amount_ars,
      payment_date,
      notes,
      patients ( full_name ),
      profiles ( full_name )
    `)
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)
    .order('payment_date', { ascending: false })
    .limit(200);

  const payments: Payment[] = paymentsRaw
    ? (paymentsRaw as unknown as Payment[])
    : [];

  return (
    <div className={styles.page}>
      <EjecutivoTabs tabs={availableTabs} activeTab={activeTab} />

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Dashboard Ejecutivo</h1>
          <span className={styles.period}>{monthLabel}</span>
        </div>
        <div className={styles.periodControls}>
          <Suspense fallback={<div className={styles.periodControls} />}>
            <PeriodSelector currentPeriod={selectedPeriod} options={periodOptions} />
          </Suspense>
        </div>
      </div>

      {paymentsError && (
        <div className={styles.errorBanner}>
          Error al cargar los pagos. Verificá la conexión con Supabase.
        </div>
      )}

      {pendingReviewCount > 0 && canRevision && (
        <div
          style={{
            backgroundColor: 'rgba(197, 164, 126, 0.12)',
            border: '1px solid var(--color-champagne)',
            borderRadius: '6px',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.9rem',
          }}
        >
          <div>
            ⚠️ <strong>Atención:</strong> Hay <strong>{pendingReviewCount}</strong> cobro(s) con datos pendientes de completar (asignar profesional o vincular paciente en el padrón).
          </div>
          <Link
            href="/dashboard/ejecutivo?tab=revision"
            style={{
              color: '#1c1c1c',
              backgroundColor: 'var(--color-champagne)',
              padding: '0.35rem 0.75rem',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.8rem',
              textDecoration: 'none',
            }}
          >
            Ver pendientes →
          </Link>
        </div>
      )}

      {/* Caso A: Cero cobros en toda la base de datos */}
      {totalInDb === 0 && !paymentsError && (
        <div className={styles.infoBanner}>
          ℹ️ <strong>Información pendiente de importación:</strong> La información de cobros todavía no fue importada desde la planilla. Los indicadores financieros y comisiones se actualizarán automáticamente apenas se complete la carga de la Base Unificada.
        </div>
      )}

      {/* Caso B: Hay cobros en la base, pero ninguno en este mes seleccionado */}
      {totalInDb > 0 && monthRows.length === 0 && !paymentsError && (
        <div className={styles.emptyPeriodBanner}>
          ℹ️ <strong>Período sin cobros registrados:</strong> No hay cobros registrados en <strong>{monthLabel}</strong>. Hay <strong>{totalInDb}</strong> cobro(s) en otros períodos{latestMonthLabel ? ` (último registrado: ${latestMonthLabel})` : ''}. Podés seleccionar otro mes con el selector superior.
        </div>
      )}

      {/* Tarjetas métricas (Stock removido, USD dedicado, Tratamientos vs Productos, Facturación menos comisiones) */}
      <section className={styles.metricsGrid}>
        {/* Tratamientos ARS */}
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Facturación Tratamientos</p>
          <p className={treatmentRows.length > 0 ? styles.metricValue : `${styles.metricValue} ${styles.metricEmpty}`}>
            {treatmentRows.length > 0 ? formatARS(totalTreatmentsARS) : totalInDb > 0 ? '$ 0' : 'Sin datos'}
          </p>
          <p className={styles.metricSub}>
            {treatmentRows.length} {treatmentRows.length === 1 ? 'tratamiento' : 'tratamientos'}
          </p>
        </div>

        {/* Venta de Productos ARS (Punto E) */}
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Venta de Productos</p>
          <p className={productRows.length > 0 ? styles.metricValue : `${styles.metricValue} ${styles.metricEmpty}`}>
            {productRows.length > 0 ? formatARS(totalProductsARS) : totalInDb > 0 ? '$ 0' : 'Sin ventas'}
          </p>
          <p className={styles.metricSub}>
            {productRows.length} {productRows.length === 1 ? 'producto' : 'productos'} vendidos
          </p>
        </div>

        {/* Facturación USD dedicada sin conversión (Punto C) */}
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Facturación USD</p>
          <p className={usdRows.length > 0 ? styles.metricValue : `${styles.metricValue} ${styles.metricEmpty}`}>
            {usdRows.length > 0 ? formatUSD(totalUSD) : totalInDb > 0 ? 'US$ 0' : 'Sin datos'}
          </p>
          <p className={styles.metricSub}>
            {usdRows.length} {usdRows.length === 1 ? 'cobro' : 'cobros'} en dólares (sin conversión)
          </p>
        </div>

        {/* Facturación menos comisiones (Punto F) */}
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Facturación menos comisiones</p>
          <p className={paidRows.length > 0 ? `${styles.metricValue} ${styles.metricHighlight}` : `${styles.metricValue} ${styles.metricEmpty}`}>
            {paidRows.length > 0 ? formatARS(facturacionMenosComisiones) : totalInDb > 0 ? '$ 0' : 'Sin datos'}
          </p>
          <p className={styles.metricSub} style={{ fontSize: '0.72rem', color: 'var(--color-gris)' }}>
            (no incluye costos operativos ni insumos)
          </p>
        </div>

        {/* Comisión Mercedes (30%) */}
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Comisión Mercedes (30%)</p>
          <p className={totalMercedesCommission > 0 ? styles.metricValue : `${styles.metricValue} ${styles.metricEmpty}`}>
            {totalMercedesCommission > 0 ? formatARS(totalMercedesCommission) : totalInDb > 0 ? '$ 0' : 'Sin datos'}
          </p>
          <p className={styles.metricSub}>cosmetología</p>
        </div>

        {/* En Revisión */}
        {canRevision && (
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>En Revisión</p>
            <p className={pendingReviewCount > 0 ? `${styles.metricValue} ${styles.metricHighlight}` : `${styles.metricValue} ${styles.metricEmpty}`}>
              {pendingReviewCount}
            </p>
            <p className={styles.metricSub}>
              <Link
                href="/dashboard/ejecutivo?tab=revision"
                style={{
                  color: 'var(--color-champagne)',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Ver incidencias →
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* Tabla mensual con columna de Profesional (Punto D) */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pagos registrados de {monthLabel}</h2>
        {payments.length === 0 ? (
          <p className={styles.emptyState}>
            No hay pagos registrados para este período.
          </p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Fecha</th>
                  <th className={styles.th}>Paciente</th>
                  <th className={styles.th}>Profesional</th>
                  <th className={styles.th}>Método</th>
                  <th className={styles.th}>Moneda</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Monto ARS</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Monto USD</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Comisión</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const isZero = Number(payment.amount_ars) === 0 && Number(payment.amount_usd ?? 0) === 0;
                  const isUSD = payment.currency === 'USD' || (payment.amount_usd != null && Number(payment.amount_usd) > 0);
                  return (
                    <tr key={payment.id} className={styles.tr}>
                      <td className={styles.td}>{formatDate(payment.payment_date)}</td>
                      <td className={styles.td}>
                        {payment.patients?.full_name ?? (
                          payment.notes?.match(/\[SIN-PACIENTE DNI:([^\]]+)\]/) ? (
                            <span title="Paciente pendiente de vincular en el padrón" style={{ color: 'var(--color-gris)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                              DNI {payment.notes.match(/\[SIN-PACIENTE DNI:([^\]]+)\]/)![1].trim()}
                            </span>
                          ) : '—'
                        )}
                      </td>
                      <td className={styles.td} style={{ fontWeight: 500 }}>
                        {payment.profiles?.full_name ? (
                          payment.profiles.full_name
                        ) : isProductSale(payment.notes) ? (
                          <span style={{ color: 'var(--color-gris)', fontWeight: 400, fontSize: '0.85rem' }}>
                            Mostrador
                          </span>
                        ) : (
                          <span style={{ color: '#b45309', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}>
                            Sin asignar
                          </span>
                        )}
                      </td>
                      <td className={styles.td}>{payment.payment_method}</td>
                      <td className={styles.td}>{payment.currency}</td>
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        {Number(payment.amount_ars) > 0 ? formatARS(Number(payment.amount_ars)) : isUSD ? '—' : '$ 0'}
                        {isZero && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginLeft: '0.5rem',
                              fontSize: '0.72rem',
                              padding: '0.12rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(0, 0, 0, 0.05)',
                              color: 'var(--color-gris)',
                              border: '1px solid var(--color-gris-claro)',
                              fontWeight: 500,
                              verticalAlign: 'middle',
                            }}
                          >
                            Sin cobro
                          </span>
                        )}
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        {payment.amount_usd != null && Number(payment.amount_usd) > 0
                          ? formatUSD(Number(payment.amount_usd))
                          : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        {Number(payment.commission_amount_ars) > 0
                          ? formatARS(Number(payment.commission_amount_ars))
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
