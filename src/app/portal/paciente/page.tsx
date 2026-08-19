// Portal Paciente — acceso para rol `paciente` y también `admin`.
// Shows appointment history, product purchases, and active gift cards
// for the authenticated patient.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Mi Portal | Dra. Landaburo',
};

type PatientProfile = {
  id: string;        // patients.id
  profile_id: string;
};

type Appointment = {
  id: string;
  appointment_date: string;
  status: string;
  notes: string | null;
  treatments: { title: string } | null;
};

type Order = {
  id: string;
  order_number: string;
  total_ars: number;
  payment_status: string;
  payment_method: string;
  created_at: string;
};

type GiftCard = {
  id: string;
  code: string;
  amount_ars: number;
  remaining_balance_ars: number;
  status: string;
  expiration_date: string;
};

function formatARS(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
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

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  refunded: 'Reembolsado',
  active: 'Activa',
  redeemed: 'Canjeada',
  expired: 'Vencida',
};

export default async function PortalPacientePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/portal/paciente');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  // Only patients (and admins previewing) can access this portal
  if (!profile || (profile.role !== 'paciente' && profile.role !== 'admin')) {
    redirect('/dashboard/operativo');
  }

  // Find the patient record linked to this profile
  const { data: patient } = await supabase
    .from('patients')
    .select('id, profile_id')
    .eq('profile_id', user.id)
    .single<PatientProfile>();

  // All three queries can run in parallel once we have the patient ID
  const [appointmentsResult, ordersResult, giftCardsResult] = await Promise.all([
    patient
      ? supabase
          .from('appointments')
          .select('id, appointment_date, status, notes, treatments(title)')
          .eq('patient_id', patient.id)
          .order('appointment_date', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null, error: null }),
    patient
      ? supabase
          .from('orders')
          .select('id, order_number, total_ars, payment_status, payment_method, created_at')
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null, error: null }),
    patient
      ? supabase
          .from('gift_cards')
          .select('id, code, amount_ars, remaining_balance_ars, status, expiration_date')
          .eq('purchaser_patient_id', patient.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const appointments: Appointment[] = appointmentsResult.data
    ? (appointmentsResult.data as unknown as Appointment[])
    : [];

  const orders: Order[] = ordersResult.data
    ? (ordersResult.data as unknown as Order[])
    : [];

  const giftCards: GiftCard[] = giftCardsResult.data
    ? (giftCardsResult.data as unknown as GiftCard[])
    : [];

  const userName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    'Paciente';

  return (
    <>
      <Header />
      <main className={styles.page}>
        <div className={styles.container}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Mi Portal</h1>
          <p className={styles.greeting}>Bienvenida, {userName}</p>
        </div>

        {!patient && (
          <div className={styles.noPatientBanner}>
            Tu cuenta aún no está vinculada a una ficha de paciente.
            Contactá al consultorio para completar tu registro.
          </div>
        )}

        {/* Appointments */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Mis turnos</h2>
          {appointments.length === 0 ? (
            <p className={styles.emptyState}>
              {patient
                ? 'No tenés turnos registrados todavía.'
                : 'Asociá tu cuenta para ver tus turnos.'}
            </p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Fecha</th>
                    <th className={styles.th}>Tratamiento</th>
                    <th className={styles.th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt) => (
                    <tr key={appt.id} className={styles.tr}>
                      <td className={styles.td}>
                        {formatDate(appt.appointment_date)}
                      </td>
                      <td className={styles.td}>
                        {appt.treatments?.title ?? '—'}
                      </td>
                      <td className={styles.td}>
                        <span
                          className={`${styles.badge} ${styles[`badge_${appt.status}`] ?? ''}`}
                        >
                          {STATUS_LABELS[appt.status] ?? appt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Orders */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Mis compras</h2>
          {orders.length === 0 ? (
            <p className={styles.emptyState}>
              {patient
                ? 'No tenés compras registradas todavía.'
                : 'Asociá tu cuenta para ver tus compras.'}
            </p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Fecha</th>
                    <th className={styles.th}>Nro. pedido</th>
                    <th className={styles.th}>Método</th>
                    <th className={styles.th}>Estado</th>
                    <th className={`${styles.th} ${styles.thRight}`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className={styles.tr}>
                      <td className={styles.td}>{formatDate(order.created_at)}</td>
                      <td className={styles.td}>{order.order_number}</td>
                      <td className={styles.td}>{order.payment_method}</td>
                      <td className={styles.td}>
                        <span className={styles.badge}>
                          {STATUS_LABELS[order.payment_status] ??
                            order.payment_status}
                        </span>
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        {formatARS(Number(order.total_ars))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Gift cards */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Mis gift cards</h2>
          {giftCards.length === 0 ? (
            <p className={styles.emptyState}>
              No tenés gift cards activas.
            </p>
          ) : (
            <div className={styles.giftCardGrid}>
              {giftCards.map((gc) => (
                <div
                  key={gc.id}
                  className={`${styles.giftCard} ${gc.status !== 'active' ? styles.giftCardInactive : ''}`}
                >
                  <div className={styles.giftCardTop}>
                    <span className={styles.giftCardCode}>{gc.code}</span>
                    <span className={styles.badge}>
                      {STATUS_LABELS[gc.status] ?? gc.status}
                    </span>
                  </div>
                  <p className={styles.giftCardBalance}>
                    {formatARS(Number(gc.remaining_balance_ars))}
                    {' '}
                    <span className={styles.giftCardOf}>
                      de {formatARS(Number(gc.amount_ars))}
                    </span>
                  </p>
                  <p className={styles.giftCardExpiry}>
                    Vence: {formatDate(gc.expiration_date)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
