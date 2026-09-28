import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { assertSectionAccess } from '@/lib/permissions';
import { getStockReportData } from '../actions';
import MovimientosClient from './MovimientosClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Auditoría de Movimientos de Stock | Panel Dra. Landaburo',
  description: 'Reporte de movimientos, balance contable y auditoría de inventario',
};

interface SearchParams {
  from?: string;
  to?: string;
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/dashboard/productos/movimientos');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? '';
  if (!role || role === 'paciente') {
    redirect('/portal/paciente');
  }

  await assertSectionAccess(user.id, role, 'productos');

  const resolvedParams = await searchParams;

  // Fechas por defecto: inicio del mes en curso y fecha de hoy
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const defaultStart = `${year}-${month}-01`;
  const defaultEnd = `${year}-${month}-${day}`;

  const startDate = resolvedParams.from || defaultStart;
  const endDate = resolvedParams.to || defaultEnd;

  const reportData = await getStockReportData(startDate, endDate);

  return <MovimientosClient initialData={reportData} />;
}
