import { createAdminClient } from '@/lib/supabase/admin';
import type { PaymentItem, ReviewItem, MethodTotal } from './CierreDiarioClient';

const METHOD_LABELS: Record<string, { label: string; isCash?: boolean }> = {
  efectivo: { label: 'Efectivo', isCash: true },
  transferencia: { label: 'Transferencia' },
  tarjeta_debito: { label: 'Tarjeta de Débito' },
  tarjeta_credito: { label: 'Tarjeta de Crédito' },
  mercadopago: { label: 'Mercado Pago' },
  efectivo_usd: { label: 'Efectivo USD', isCash: true },
  cheque: { label: 'Cheque' },
};

export function getLocalTodayDate(): string {
  const now = new Date();
  const tzOffset = -3 * 60; // minutes (Argentina UTC-3)
  const localNow = new Date(now.getTime() + (now.getTimezoneOffset() + tzOffset) * 60000);
  return localNow.toISOString().slice(0, 10);
}

export function formatLongDate(dateIso: string): string {
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

export interface CierreDiarioData {
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

export async function getCierreDiarioData(rawDate?: string): Promise<CierreDiarioData> {
  const todayDate = getLocalTodayDate();
  const currentDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayDate;

  const startIso = `${currentDate}T00:00:00-03:00`;
  const endIso = `${currentDate}T23:59:59.999-03:00`;

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

  const mappedPayments: PaymentItem[] = rawPayments.map((p: any) => ({
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
  }));

  const paidPayments = mappedPayments.filter(
    (p) => (p.amount_ars != null && p.amount_ars > 0) || (p.amount_usd != null && p.amount_usd > 0)
  );

  const zeroPayments = mappedPayments.filter(
    (p) =>
      (p.amount_ars == null || p.amount_ars === 0) &&
      (p.amount_usd == null || p.amount_usd === 0)
  );

  const totalArs = paidPayments.reduce((sum, p) => sum + (p.amount_ars || 0), 0);
  const totalUsd = paidPayments.reduce((sum, p) => sum + (p.amount_usd || 0), 0);

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

  return {
    currentDate,
    todayDate,
    formattedDisplayDate,
    totalArs,
    totalUsd,
    paidPayments,
    zeroPayments,
    methodTotals,
    pendingReviews,
  };
}
