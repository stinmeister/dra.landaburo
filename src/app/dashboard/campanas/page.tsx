import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { assertSectionAccess } from '@/lib/permissions';
import CampanasClient from './CampanasClient';
import type { Campaign } from './CampanasClient';

export const metadata: Metadata = {
  title: 'Campañas Publicitarias | Panel Dra. Landaburo',
};

export default async function CampanasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/dashboard/campanas');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? '';
  if (!profile || !role || role === 'paciente') redirect('/portal/paciente');

  // Guard server-side: la matriz de permisos es la unica fuente de verdad (R6)
  await assertSectionAccess(user.id, role, 'campanas');

  let campaigns: Campaign[] = [];
  try {
    const { data, error } = await supabase
      .from('ad_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      campaigns = data as Campaign[];
    }
  } catch {
    campaigns = [];
  }

  return (
    <CampanasClient
      initialCampaigns={campaigns}
      isAdmin={role === 'admin'}
    />
  );
}
