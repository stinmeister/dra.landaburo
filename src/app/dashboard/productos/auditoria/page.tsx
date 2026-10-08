// /dashboard/productos/auditoria — Solo admin. Registro inmutable de eliminaciones y archivados.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { assertSectionAccess } from '@/lib/permissions';
import { getDeletionAuditLogs } from '../actions';
import AuditoriaClient from './AuditoriaClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Auditoría de Bajas y Archivados | Panel Dra. Landaburo' };

export default async function AuditoriaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/dashboard/productos/auditoria');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? '';
  if (role !== 'admin') {
    redirect('/dashboard/productos');
  }

  await assertSectionAccess(user.id, role, 'productos');

  const res = await getDeletionAuditLogs();

  return (
    <AuditoriaClient
      initialLogs={res.logs || []}
      tablePending={res.tablePending || false}
      error={res.error}
    />
  );
}
