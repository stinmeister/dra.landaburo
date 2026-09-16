import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertSectionAccess } from '@/lib/permissions';
import CierreDiarioClient, {
  PaymentItem,
  ReviewItem,
  MethodTotal,
} from './CierreDiarioClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Cierre Diario | Panel Dra. Landaburo',
};

const METHOD_LABELS: Record<string, { label: string; isCash?: boolean }> = {
  efectivo: { label: 'Efectivo', isCash: true },
  transferencia: { label: 'Transferencia' },
  tarjeta_debito: { label: 'Tarjeta de Débito' },
  tarjeta_credito: { label: 'Tarjeta de Crédito' },
  mercadopago: { label: 'Mercado Pago' },
  efectivo_usd: { label: 'Efectivo USD', isCash: true },
  cheque: { label: 'Cheque' },
};

function getLocalTodayDate(): string {
  // Fecha actual en hora argentina (UTC-3)
  const now = new Date();
  const tzOffset = -3 * 60; // minutes
  const localNow = new Date(now.getTime() + (now.getTimezoneOffset() + tzOffset) * 60000);
  return localNow.toISOString().slice(0, 10);
}

function formatLongDate(dateIso: string): string {
  try {
    const [y, m, d] = dateIso.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(dateObj);
  } catch {
    return dateIso;
  }
}

export default async function CierreDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/dashboard/cierre-diario');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? '';
  if (!role || role === 'paciente') redirect('/portal/paciente');

  // Guard de permisos: 'cierre-diario'
  await assertSectionAccess(user.id, role, 'cierre-diario');

  const resolvedParams = await searchParams;
  const todayDate = getLocalTodayDate();
  const rawDate = resolvedParams?.fecha?.trim();
  const currentDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayDate;

  const startIso = `${currentDate}T00:00:00-03:00`;
  const endIso = `${currentDate}T23:59:59.999-03:00`;

  // Ejecución paralela de las 2 consultas
  const admin = createAdminClient();
  const [paymentsRes, reviewsRes] = await Promise.all([
    admin
      .from('payments')
      .select(`
        id,
        payment_date,
        amount_ars,
        amount_usd,
        currency,
        payment_method,
        notes,
        external_id,
        patients ( full_name, dni ),
        profiles ( full_name )
      `)
      .gte('payment_date', startIso)
      .lte('payment_date', endIso)
      .order('payment_date', { ascending: true }),

    admin
      .from('ingest_review')
      .select('id, record_identifier, reason, created_at')
      .eq('source', 'payments')
      .eq('status', 'pending')
      .gte('created_at', startIso)
      .lte('created_at', endIso),
  ]);

  const rawPayments = paymentsRes.data ?? [];
  const rawReviews = reviewsRes.data ?? [];

  // Mapear pagos a formato normalizado
  const mappedPayments: PaymentItem[] = rawPayments.map((p: any) => {
    return {
      id: p.id,
      payment_date: p.payment_date,
      amount_ars: p.amount_ars != null ? Number(p.amount_ars) : null,
      amount_usd: p.amount_usd != null ? Number(p.amount_usd) : null,
      currency: p.currency || 'ARS',
      payment_method: p.payment_method || 'efectivo',
      notes: p.notes,
      external_id: p.external_id,
      patient_name: p.patients?.full_name || 'Paciente sin registrar',
      patient_dni: p.patients?.dni || null,
      professional_name: p.profiles?.full_name || 'Sin profesional asignado',
    };
  });

  // Separar cobros con monto de atenciones en $0
  const paidPayments = mappedPayments.filter(
    (p) => (p.amount_ars != null && p.amount_ars > 0) || (p.amount_usd != null && p.amount_usd > 0)
  );

  const zeroPayments = mappedPayments.filter(
    (p) =>
      (p.amount_ars == null || p.amount_ars === 0) &&
      (p.amount_usd == null || p.amount_usd === 0)
  );

  // Calcular totales
  const totalArs = paidPayments.reduce((sum, p) => sum + (p.amount_ars || 0), 0);
  const totalUsd = paidPayments.reduce((sum, p) => sum + (p.amount_usd || 0), 0);

  // Agrupación por medio de pago
  const methodMap: Record<string, MethodTotal> = {};
  for (const p of paidPayments) {
    const key = p.payment_method || 'efectivo';
    if (!methodMap[key]) {
      const conf = METHOD_LABELS[key] || {
        label: key.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      };
      methodMap[key] = {
        method: key,
        label: conf.label,
        amount_ars: 0,
        amount_usd: 0,
        count: 0,
        isCash: conf.isCash,
      };
    }
    methodMap[key].amount_ars += p.amount_ars || 0;
    methodMap[key].amount_usd += p.amount_usd || 0;
    methodMap[key].count += 1;
  }

  const methodTotals = Object.values(methodMap).sort((a, b) => {
    if (a.isCash && !b.isCash) return -1;
    if (!a.isCash && b.isCash) return 1;
    return b.amount_ars - a.amount_ars;
  });

  const pendingReviews: ReviewItem[] = rawReviews.map((r: any) => ({
    id: r.id,
    record_identifier: r.record_identifier,
    reason: r.reason,
    created_at: r.created_at,
  }));

  const formattedDisplayDate = formatLongDate(currentDate);

  return (
    <CierreDiarioClient
      currentDate={currentDate}
      todayDate={todayDate}
      formattedDisplayDate={formattedDisplayDate}
      totalArs={totalArs}
      totalUsd={totalUsd}
      paidPayments={paidPayments}
      zeroPayments={zeroPayments}
      methodTotals={methodTotals}
      pendingReviews={pendingReviews}
    />
  );
}
