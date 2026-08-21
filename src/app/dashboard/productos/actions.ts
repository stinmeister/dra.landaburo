'use server';
import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard/operativo');
  return user;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function createProduct(formData: FormData) {
  await assertAdmin();

  const name          = (formData.get('name') as string)?.trim();
  const category      = (formData.get('category') as string)?.trim();
  const price_ars     = parseFloat(formData.get('price_ars') as string);
  const stock_quantity = parseInt(formData.get('stock_quantity') as string, 10);
  const description   = (formData.get('description') as string)?.trim() ?? '';
  const image_url     = (formData.get('image_url') as string)?.trim() ?? null;

  if (!name || !category || isNaN(price_ars)) return;

  const slug = slugify(name);
  const admin = getAdminClient();

  await admin.from('products').insert({
    name, slug, category, price_ars,
    stock_quantity: isNaN(stock_quantity) ? 0 : stock_quantity,
    description, image_url, is_active: true,
  });

  revalidatePath('/dashboard/productos');
  revalidatePath('/tienda');
}

export async function toggleProduct(formData: FormData) {
  await assertAdmin();

  const id        = formData.get('id') as string;
  const isActive  = formData.get('is_active') === 'true';

  if (!id) return;

  const admin = getAdminClient();
  await admin.from('products').update({ is_active: !isActive }).eq('id', id);

  revalidatePath('/dashboard/productos');
  revalidatePath('/tienda');
}

export async function updateStock(formData: FormData) {
  await assertAdmin();

  const id    = formData.get('id') as string;
  const delta = parseInt(formData.get('delta') as string, 10);

  if (!id || isNaN(delta)) return;

  const admin = getAdminClient();
  const { data } = await admin.from('products').select('stock_quantity').eq('id', id).single();
  if (!data) return;

  const newStock = Math.max(0, (data.stock_quantity ?? 0) + delta);
  await admin.from('products').update({ stock_quantity: newStock }).eq('id', id);

  revalidatePath('/dashboard/productos');
}
