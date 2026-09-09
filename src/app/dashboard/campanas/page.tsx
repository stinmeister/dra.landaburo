import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import CampanasClient from './CampanasClient';
import type { Campaign } from './CampanasClient';

export const metadata: Metadata = {
  title: 'Campañas Publicitarias | Panel Dra. Landaburo',
};

const ALLOWED_ROLES = ['admin', 'medico', 'operativo', 'cosmetologa', 'recepcionista'];

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
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    redirect('/portal/paciente');
  }

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
      isAdmin={profile.role === 'admin'}
    />
  );
}
