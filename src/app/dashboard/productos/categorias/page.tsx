// /dashboard/productos/categorias — Gestión de categorías para admin y operativo
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { assertSectionAccess } from '@/lib/permissions';
import { getProductCategories } from '../actions';
import CategoriasClient from './CategoriasClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Categorías | Panel Dra. Landaburo' };

export default async function CategoriasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/dashboard/productos/categorias');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? '';
  if (role !== 'admin' && role !== 'operativo') {
    // Si no es admin ni operativo, no tiene permiso de gestión
    redirect('/dashboard/productos');
  }

  // Verificación por matriz de permisos
  await assertSectionAccess(user.id, role, 'productos');

  const { categories, error } = await getProductCategories();

  return (
    <CategoriasClient
      initialCategories={categories || []}
      loadError={error}
      userRole={role}
    />
  );
}
