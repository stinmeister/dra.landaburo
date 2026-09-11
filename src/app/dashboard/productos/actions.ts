'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';



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

  const name            = (formData.get('name') as string)?.trim();
  const category        = (formData.get('category') as string)?.trim();
  const price_ars       = parseFloat(formData.get('price_ars') as string);
  const stock_quantity  = parseInt(formData.get('stock_quantity') as string, 10);
  const min_stock_alert = parseInt(formData.get('min_stock_alert') as string, 10);
  const description     = (formData.get('description') as string)?.trim() ?? '';
  const image_url       = (formData.get('image_url') as string)?.trim() ?? null;

  if (!name || !category || isNaN(price_ars)) return;

  const slug = slugify(name);
  const admin = createAdminClient();

  const insertData: any = {
    name, slug, category, price_ars,
    stock_quantity: isNaN(stock_quantity) ? 0 : stock_quantity,
    min_stock_alert: isNaN(min_stock_alert) ? 5 : min_stock_alert,
    description, image_url, is_active: true,
  };

  const { error: insErr } = await admin.from('products').insert(insertData);
  if (insErr && insErr.code === '42703') {
    const { min_stock_alert: _, ...fallbackData } = insertData;
    await admin.from('products').insert(fallbackData);
  }

  revalidatePath('/dashboard/productos');
  revalidatePath('/tienda');
}

export async function toggleProduct(formData: FormData) {
  await assertAdmin();

  const id        = formData.get('id') as string;
  const isActive  = formData.get('is_active') === 'true';

  if (!id) return;

  const admin = createAdminClient();
  await admin.from('products').update({ is_active: !isActive }).eq('id', id);

  revalidatePath('/dashboard/productos');
  revalidatePath('/tienda');
}

async function assertStaffCanManageProducts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single();
  if (!profile || profile.role === 'paciente') redirect('/portal/paciente');
  if (profile.role === 'admin') return user;
  const staffAllowed = ['admin', 'operativo', 'cosmetologa', 'medico'];
  if (!staffAllowed.includes(profile.role)) redirect('/dashboard/operativo');
  return user;
}

export async function updateStock(formData: FormData): Promise<{ success: boolean; newStock?: number; error?: string }> {
  try {
    await assertStaffCanManageProducts();

    const id    = formData.get('id') as string;
    const delta = parseInt(formData.get('delta') as string, 10);

    if (!id || isNaN(delta)) {
      return { success: false, error: 'Parámetros inválidos para actualizar stock.' };
    }

    const admin = createAdminClient();
    const { data, error: fetchErr } = await admin.from('products').select('stock_quantity').eq('id', id).single();
    if (fetchErr || !data) {
      return { success: false, error: `No se encontró el producto: ${fetchErr?.message || 'ID no existe'}` };
    }

    const newStock = Math.max(0, (data.stock_quantity ?? 0) + delta);
    const { error: updErr } = await admin.from('products').update({ stock_quantity: newStock }).eq('id', id);
    if (updErr) {
      return { success: false, error: `Error al modificar stock en base de datos: ${updErr.message}` };
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/operativo');
    revalidatePath('/tienda');

    return { success: true, newStock };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar el stock.' };
  }
}

export async function updateProduct(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffCanManageProducts();

    const id              = (formData.get('id') as string)?.trim();
    const name            = (formData.get('name') as string)?.trim();
    const category        = (formData.get('category') as string)?.trim();
    const price_ars       = parseFloat(formData.get('price_ars') as string);
    const stock_quantity  = parseInt(formData.get('stock_quantity') as string, 10);
    const min_stock_alert = parseInt(formData.get('min_stock_alert') as string, 10);
    const description     = (formData.get('description') as string)?.trim() ?? '';
    const image_url       = (formData.get('image_url') as string)?.trim() ?? null;

    if (!id || !name || !category || isNaN(price_ars)) {
      return { success: false, error: 'Completá los campos obligatorios del producto (nombre, categoría, precio).' };
    }

    const admin = createAdminClient();
    const updateData: any = {
      name,
      category,
      price_ars,
      stock_quantity: isNaN(stock_quantity) ? 0 : stock_quantity,
      min_stock_alert: isNaN(min_stock_alert) ? 5 : min_stock_alert,
      description,
      image_url: image_url || null,
    };

    const { error: updErr } = await admin.from('products').update(updateData).eq('id', id);
    if (updErr) {
      if (updErr.code === '42703') {
        const { min_stock_alert: _, ...fallbackUpdate } = updateData;
        const { error: fbErr } = await admin.from('products').update(fallbackUpdate).eq('id', id);
        if (fbErr) return { success: false, error: `Error al actualizar producto: ${fbErr.message}` };
      } else {
        return { success: false, error: `Error al actualizar producto: ${updErr.message}` };
      }
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/operativo');
    revalidatePath('/tienda');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al guardar los datos del producto.' };
  }
}

export async function uploadProductImage(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await assertAdmin();

    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return { success: false, error: 'No se recibió ningún archivo válido.' };
    }

    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'El archivo debe ser una imagen (JPG, PNG, WEBP).' };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'La imagen no debe superar los 5MB.' };
    }

    const admin = createAdminClient();

    // Subir imagen al bucket 'products' (bucket aprovisionado)
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await admin.storage
      .from('products')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error('[Storage Upload Error]:', uploadErr);
      return { success: false, error: `Error de almacenamiento: ${uploadErr.message}` };
    }

    const { data: publicUrlData } = admin.storage.from('products').getPublicUrl(fileName);
    return { success: true, url: publicUrlData.publicUrl };
  } catch (err: any) {
    console.error('[uploadProductImage Error]:', err);
    return { success: false, error: err.message || 'Error al procesar la imagen' };
  }
}
