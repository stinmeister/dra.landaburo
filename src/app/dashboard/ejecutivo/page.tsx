// Dashboard Ejecutivo — acceso exclusivo rol `admin`.
// Server Component: queries run at request time, no client-side loading states.
// Shows monthly financials (ARS/USD + commissions) and low-stock alerts.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
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

  // Verify session and role — middleware already blocks unauthenticated users
  // but we re-check role here for defence in depth (admin-only page)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile || profile.role !== 'admin') {
    redirect('/');
  }

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

      {/* Metric cards */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Facturación ARS</p>
          <p className={styles.metricValue}>{formatARS(totalARS)}</p>
          <p className={styles.metricSub}>{payments.length} pagos</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Facturación USD</p>
          <p className={styles.metricValue}>{formatUSD(totalUSD)}</p>
          <p className={styles.metricSub}>equivalente del mes</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Comisión Dra. (70%)</p>
          <p className={`${styles.metricValue} ${styles.metricHighlight}`}>
            {formatARS(totalDraCommission)}
          </p>
          <p className={styles.metricSub}>neto del mes</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Comisión Mercedes (30%)</p>
          <p className={styles.metricValue}>{formatARS(totalMercedesCommission)}</p>
          <p className={styles.metricSub}>cosmetología</p>
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
    </div>
  );
}
