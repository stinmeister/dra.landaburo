import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertSectionAccess } from '@/lib/permissions';
import RecuentoClient from './RecuentoClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Recuento Mensual de Stock | Panel Dra. Landaburo',
  description: 'Relevamiento físico mensual y conciliación de inventario',
};

export default async function RecuentoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/dashboard/productos/recuento');
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

  const admin = createAdminClient();

  // Obtener categorías activas
  const { data: catRows } = await admin
    .from('product_categories')
    .select('name')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  // Obtener productos activos
  const { data: prodRows } = await admin
    .from('products')
    .select('id, name, category, brand_type, stock_quantity')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const products = (prodRows || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category || 'General',
    brand_type: p.brand_type || 'Bellivm',
    stock_quantity: p.stock_quantity ?? 0,
  }));

  const categories = catRows && catRows.length > 0
    ? catRows.map((c) => c.name)
    : Array.from(new Set(products.map((p) => p.category))).sort();

  return (
    <RecuentoClient products={products} categories={categories} />
  );
}
