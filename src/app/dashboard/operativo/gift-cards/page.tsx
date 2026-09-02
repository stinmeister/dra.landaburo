import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import GiftCardsAdminPage from './GiftCardsAdmin';

export const metadata: Metadata = {
  title: 'Gift Cards — Validar y Canjear | Dashboard',
};

const ALLOWED_ROLES = ['admin', 'medico', 'operativo', 'recepcionista'];

export default async function GiftCardsDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) redirect('/');

  return <GiftCardsAdminPage />;
}
