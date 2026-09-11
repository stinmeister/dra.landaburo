// Dashboard Ejecutivo — acceso exclusivo rol `admin`.
// Server Component: queries run at request time, no client-side loading states.
// Shows monthly financials (ARS/USD + commissions), low-stock alerts, and MP config.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertSectionAccess } from '@/lib/permissions';
import { getPendingReviewCount } from '@/lib/ingest-review';
import MPConfigForm from '@/components/dashboard/MPConfigForm';
import styles from './page.module.css';

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
  patients: { full_name: string } | null;
};

type Product = {
  id: string;
  name: string;
  stock_quantity: number;
  min_stock_alert: number;
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

export default async function EjecutivoPage() {
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

  // Guard server-side: la matriz de permisos es la unica fuente de verdad (R6)
  await assertSectionAccess(user.id, role, 'ejecutivo');

  // Date range: first and last moment of the current calendar month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Fetch current-month payments with patient name for the table
  const { data: paymentsRaw, error: paymentsError } = await supabase
    .from('payments')
    .select('id, amount_ars, amount_usd, currency, payment_method, commission_amount_ars, payment_date, patients(full_name)')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)
    .order('payment_date', { ascending: false })
    .limit(50);

  const payments: Payment[] = paymentsRaw
    ? (paymentsRaw as unknown as Payment[])
    : [];

  // Aggregate metrics
  const totalARS = payments.reduce((sum, p) => sum + Number(p.amount_ars), 0);
  const totalUSD = payments.reduce((sum, p) => sum + Number(p.amount_usd ?? 0), 0);
  const totalMercedesCommission = payments.reduce(
    (sum, p) => sum + Number(p.commission_amount_ars),
    0
  );
  const totalDraCommission = totalARS - totalMercedesCommission;

  // Supabase/PostgREST doesn't support column-to-column comparisons natively,
  // so we fetch all active products and filter in JS — dataset is small (<50 rows).
  const { data: allProductsRaw } = await supabase
    .from('products')
    .select('id, name, stock_quantity, min_stock_alert')
    .eq('is_active', true)
    .order('stock_quantity', { ascending: true });

  const allProducts: Product[] = allProductsRaw
    ? (allProductsRaw as unknown as Product[])
    : [];

  const lowStock = allProducts.filter(
    (p) => p.stock_quantity < p.min_stock_alert
  );

  const pendingReviewCount = await getPendingReviewCount();

  const monthLabel = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(now);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Dashboard Ejecutivo</h1>
        <span className={styles.period}>{monthLabel}</span>
      </div>

      {paymentsError && (
        <div className={styles.errorBanner}>
          Error al cargar los pagos. Verificá la conexión con Supabase.
        </div>
      )}

      {pendingReviewCount > 0 && (
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
            ⚠️ <strong>Atención:</strong> Hay <strong>{pendingReviewCount}</strong> registro(s) pendiente(s) de revisión (cobros en USD, posibles duplicados, incidencias de datos).
          </div>
          <Link
            href="/dashboard/revision"
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

      {payments.length === 0 && !paymentsError && (
        <div className={styles.infoBanner}>
          ℹ️ <strong>Métricas financieras:</strong> Actualmente no hay cobros registrados en el sistema para este período. Los indicadores de facturación y comisiones se actualizarán automáticamente a medida que se ingresen pagos o se sincronice con el punto de venta / Calu.
        </div>
      )}

      {/* Metric cards */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Facturación ARS</p>
          <p className={payments.length > 0 ? styles.metricValue : `${styles.metricValue} ${styles.metricEmpty}`}>
            {payments.length > 0 ? formatARS(totalARS) : 'Sin datos registrados'}
          </p>
          <p className={styles.metricSub}>{payments.length} pagos</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Facturación USD</p>
          <p className={payments.length > 0 ? styles.metricValue : `${styles.metricValue} ${styles.metricEmpty}`}>
            {payments.length > 0 ? formatUSD(totalUSD) : 'Sin datos registrados'}
          </p>
          <p className={styles.metricSub}>equivalente del mes</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Comisión Dra. (70%)</p>
          <p className={payments.length > 0 ? `${styles.metricValue} ${styles.metricHighlight}` : `${styles.metricValue} ${styles.metricEmpty}`}>
            {payments.length > 0 ? formatARS(totalDraCommission) : 'Sin datos registrados'}
          </p>
          <p className={styles.metricSub}>neto del mes</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Comisión Mercedes (30%)</p>
          <p className={payments.length > 0 ? styles.metricValue : `${styles.metricValue} ${styles.metricEmpty}`}>
            {payments.length > 0 ? formatARS(totalMercedesCommission) : 'Sin datos registrados'}
          </p>
          <p className={styles.metricSub}>cosmetología</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>En Revisión</p>
          <p className={pendingReviewCount > 0 ? `${styles.metricValue} ${styles.metricHighlight}` : `${styles.metricValue} ${styles.metricEmpty}`}>
            {pendingReviewCount}
          </p>
          <p className={styles.metricSub}>
            <Link
              href="/dashboard/revision"
              style={{
                color: 'var(--color-champagne)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              Ver registros →
            </Link>
          </p>
        </div>
      </section>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Alertas de stock bajo
            <span className={styles.alertBadge}>{lowStock.length}</span>
          </h2>
          <div className={styles.alertGrid}>
            {lowStock.map((product) => (
              <div key={product.id} className={styles.alertCard}>
                <p className={styles.alertName}>{product.name}</p>
                <p className={styles.alertStock}>
                  <span className={styles.alertQty}>{product.stock_quantity}</span>
                  {' '}unidades (mín. {product.min_stock_alert})
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payments table */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Últimos pagos del mes</h2>
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
                  <th className={styles.th}>Método</th>
                  <th className={styles.th}>Moneda</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Monto ARS</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Comisión</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className={styles.tr}>
                    <td className={styles.td}>{formatDate(payment.payment_date)}</td>
                    <td className={styles.td}>
                      {payment.patients?.full_name ?? '—'}
                    </td>
                    <td className={styles.td}>{payment.payment_method}</td>
                    <td className={styles.td}>{payment.currency}</td>
                    <td className={`${styles.td} ${styles.tdRight}`}>
                      {formatARS(Number(payment.amount_ars))}
                    </td>
                    <td className={`${styles.td} ${styles.tdRight}`}>
                      {formatARS(Number(payment.commission_amount_ars))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Configuración de MercadoPago — Client Component */}
      <MPConfigForm />
    </div>
  );
}
