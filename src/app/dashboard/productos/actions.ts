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
  if (!user) {
    throw new Error('Sesión no iniciada. Por favor iniciá sesión nuevamente.');
  }
  const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single();
  if (!profile || profile.role === 'paciente') {
    throw new Error('Sin permisos de staff para gestionar inventario.');
  }
  const staffAllowed = ['admin', 'operativo', 'cosmetologa', 'medico'];
  if (!staffAllowed.includes(profile.role)) {
    throw new Error('Rol no autorizado para modificar stock.');
  }
  return user;
}

export type StockMovementType =
  | 'recuento_fisico'
  | 'reposicion'
  | 'venta'
  | 'ajuste_diferencia'
  | 'baja';

interface RecordMovementParams {
  productId: string;
  previousStock: number;
  newStock: number;
  movementType?: StockMovementType | string;
  notes?: string;
  userId: string;
}

async function recordStockMovementSafely(admin: any, params: RecordMovementParams) {
  try {
    const delta = params.newStock - params.previousStock;
    const movementType =
      params.movementType ||
      (delta > 0 ? 'reposicion' : delta < 0 ? 'venta' : 'recuento_fisico');

    const { error } = await admin.from('stock_movements').insert({
      product_id: params.productId,
      previous_stock: params.previousStock,
      new_stock: params.newStock,
      quantity_delta: delta,
      movement_type: movementType,
      notes: params.notes || null,
      created_by: params.userId,
    });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[stock_movements] Tabla aún no provisionada en DB. Migración DDL pendiente.');
      } else {
        console.error('[stock_movements] Error al registrar movimiento:', error);
      }
    }
  } catch (err) {
    console.warn('[stock_movements] Excepción al registrar movimiento:', err);
  }
}

export async function updateStock(
  targetOrFormData: string | FormData,
  maybeDelta?: number,
  movementType?: StockMovementType,
  notes?: string
): Promise<{ success: boolean; newStock?: number; error?: string }> {
  try {
    const user = await assertStaffCanManageProducts();

    let id: string = '';
    let delta: number = 0;

    if (typeof targetOrFormData === 'string') {
      id = targetOrFormData.trim();
      delta = typeof maybeDelta === 'number' ? maybeDelta : 0;
    } else if (targetOrFormData instanceof FormData || (targetOrFormData && typeof (targetOrFormData as any).get === 'function')) {
      id = ((targetOrFormData.get('id') as string) || '').trim();
      delta = parseInt((targetOrFormData.get('delta') as string) || '0', 10);
    } else if (typeof targetOrFormData === 'object' && targetOrFormData !== null) {
      id = ((targetOrFormData as any).id || '').trim();
      delta = Number((targetOrFormData as any).delta) || 0;
    }

    if (!id || isNaN(delta) || delta === 0) {
      return { success: false, error: 'Parámetros inválidos para actualizar stock.' };
    }

    const admin = createAdminClient();
    const { data, error: fetchErr } = await admin
      .from('products')
      .select('stock_quantity')
      .eq('id', id)
      .single();

    if (fetchErr || !data) {
      return { success: false, error: `No se encontró el producto: ${fetchErr?.message || 'ID no existe'}` };
    }

    const oldStock = data.stock_quantity ?? 0;
    const newStock = Math.max(0, oldStock + delta);
    const { error: updErr } = await admin
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', id);

    if (updErr) {
      return { success: false, error: `Error al modificar stock en base de datos: ${updErr.message}` };
    }

    // Registrar movimiento en historial con auditoría
    await recordStockMovementSafely(admin, {
      productId: id,
      previousStock: oldStock,
      newStock,
      movementType,
      notes,
      userId: user.id,
    });

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/operativo');
    revalidatePath('/tienda');

    return { success: true, newStock };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar el stock.' };
  }
}

export async function adjustStockWithMovement(
  productId: string,
  newStock: number,
  movementType: StockMovementType,
  notes?: string
): Promise<{ success: boolean; newStock?: number; error?: string }> {
  try {
    const user = await assertStaffCanManageProducts();
    const id = (productId || '').trim();
    if (!id || isNaN(newStock) || newStock < 0) {
      return { success: false, error: 'Valor de stock o ID de producto inválido.' };
    }

    const admin = createAdminClient();
    const { data, error: fetchErr } = await admin
      .from('products')
      .select('stock_quantity')
      .eq('id', id)
      .single();

    if (fetchErr || !data) {
      return { success: false, error: `No se encontró el producto: ${fetchErr?.message || 'ID no existe'}` };
    }

    const oldStock = data.stock_quantity ?? 0;
    if (oldStock === newStock) {
      return { success: true, newStock: oldStock };
    }

    const { error: updErr } = await admin
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', id);

    if (updErr) {
      return { success: false, error: `Error al actualizar stock: ${updErr.message}` };
    }

    await recordStockMovementSafely(admin, {
      productId: id,
      previousStock: oldStock,
      newStock,
      movementType,
      notes,
      userId: user.id,
    });

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/operativo');
    revalidatePath('/tienda');

    return { success: true, newStock };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al ajustar stock.' };
  }
}

export async function getStockMovements(productId: string): Promise<{
  success: boolean;
  movements: any[];
  ddlPending: boolean;
  error?: string;
}> {
  try {
    await assertStaffCanManageProducts();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('stock_movements')
      .select(`
        id,
        previous_stock,
        new_stock,
        quantity_delta,
        movement_type,
        notes,
        created_at,
        created_by,
        profiles ( full_name, role )
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { success: true, movements: [], ddlPending: true };
      }
      return { success: false, movements: [], ddlPending: false, error: error.message };
    }

    return { success: true, movements: data || [], ddlPending: false };
  } catch (err: any) {
    return { success: false, movements: [], ddlPending: false, error: err?.message };
  }
}

export async function updateProduct(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await assertStaffCanManageProducts();

    const id              = (formData.get('id') as string)?.trim();
    const name            = (formData.get('name') as string)?.trim();
    const category        = (formData.get('category') as string)?.trim();
    const price_ars       = parseFloat(formData.get('price_ars') as string);
    const stock_quantity  = parseInt(formData.get('stock_quantity') as string, 10);
    const min_stock_alert = parseInt(formData.get('min_stock_alert') as string, 10);
    const description     = (formData.get('description') as string)?.trim() ?? '';
    const image_url       = (formData.get('image_url') as string)?.trim() ?? null;
    const movement_type   = (formData.get('movement_type') as string)?.trim() as StockMovementType || 'recuento_fisico';
    const stock_notes     = (formData.get('stock_notes') as string)?.trim() || 'Ajuste directo en edición de producto';

    if (!id || !name || !category || isNaN(price_ars)) {
      return { success: false, error: 'Completá los campos obligatorios del producto (nombre, categoría, precio).' };
    }

    const admin = createAdminClient();

    // Obtener stock anterior para auditar si varió
    const { data: currentProduct } = await admin
      .from('products')
      .select('stock_quantity')
      .eq('id', id)
      .single();

    const oldStock = currentProduct?.stock_quantity ?? 0;
    const finalStock = isNaN(stock_quantity) ? oldStock : stock_quantity;

    const updateData: any = {
      name,
      category,
      price_ars,
      stock_quantity: finalStock,
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

    // Si varió el stock, registrar en historial
    if (!isNaN(stock_quantity) && stock_quantity !== oldStock) {
      await recordStockMovementSafely(admin, {
        productId: id,
        previousStock: oldStock,
        newStock: stock_quantity,
        movementType: movement_type,
        notes: stock_notes,
        userId: user.id,
      });
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/operativo');
    revalidatePath('/tienda');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al guardar los datos del producto.' };
  }
}

// ─── Gestión de Categorías ───────────────────────────────────────────────────

export async function getProductCategories(): Promise<{
  success: boolean;
  categories: Array<{ id: string; name: string; slug: string; is_active: boolean; product_count: number }>;
  ddlPending: boolean;
  error?: string;
}> {
  try {
    const admin = createAdminClient();
    const { data: dbCategories, error } = await admin
      .from('product_categories')
      .select('*')
      .order('display_order', { ascending: true });

    // Contar productos por categoría
    const { data: prods } = await admin
      .from('products')
      .select('category');

    const counts: Record<string, number> = {};
    (prods || []).forEach((p: any) => {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    });

    if (!error && dbCategories) {
      return {
        success: true,
        categories: dbCategories.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          is_active: c.is_active,
          product_count: counts[c.name] || 0,
        })),
        ddlPending: false,
      };
    }

    // Fallback si la tabla product_categories aún no existe
    const distinct = Array.from(new Set((prods || []).map((p: any) => p.category).filter(Boolean))).sort() as string[];
    return {
      success: true,
      categories: distinct.map((name, i) => ({
        id: `fallback-${i}`,
        name,
        slug: slugify(name),
        is_active: true,
        product_count: counts[name] || 0,
      })),
      ddlPending: true,
    };
  } catch (err: any) {
    return { success: false, categories: [], ddlPending: false, error: err?.message };
  }
}

export async function createCategory(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin();
    const trimmed = name.trim();
    if (!trimmed) return { success: false, error: 'El nombre de la categoría es obligatorio.' };

    const admin = createAdminClient();
    const slug = slugify(trimmed);
    const { error } = await admin.from('product_categories').insert({
      name: trimmed,
      slug,
      is_active: true,
    });

    if (error) {
      if (error.code === '42P01') {
        return { success: false, error: 'La tabla product_categories aún no existe en la base de datos (migración DDL pendiente).' };
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/tienda');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al crear la categoría.' };
  }
}

export async function updateCategory(id: string, newName: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin();
    const trimmed = newName.trim();
    if (!id || !trimmed) return { success: false, error: 'Parámetros inválidos para renombrar categoría.' };

    const admin = createAdminClient();
    const { data: oldCat } = await admin
      .from('product_categories')
      .select('name')
      .eq('id', id)
      .single();

    const slug = slugify(trimmed);
    const { error: updErr } = await admin
      .from('product_categories')
      .update({ name: trimmed, slug })
      .eq('id', id);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    // Renombrar en cascada los productos asociados
    if (oldCat?.name && oldCat.name !== trimmed) {
      await admin
        .from('products')
        .update({ category: trimmed })
        .eq('category', oldCat.name);
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/tienda');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al renombrar categoría.' };
  }
}

export async function toggleCategory(id: string, currentActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin();
    if (!id) return { success: false, error: 'ID de categoría no válido.' };

    const admin = createAdminClient();
    const { error } = await admin
      .from('product_categories')
      .update({ is_active: !currentActive })
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/productos');
    revalidatePath('/tienda');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al alternar estado de categoría.' };
  }
}

export async function deleteCategory(id: string, categoryName: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin();
    if (!id || !categoryName) return { success: false, error: 'ID de categoría no válido.' };

    const admin = createAdminClient();
    // Requerimiento B3: No permitir borrar una categoría que tenga productos
    const { count } = await admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category', categoryName);

    if (count && count > 0) {
      return {
        success: false,
        error: `No se puede eliminar "${categoryName}" porque tiene ${count} producto(s) asignado(s). Podés desactivarla para que no se ofrezca en nuevos productos.`,
      };
    }

    const { error } = await admin
      .from('product_categories')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/productos');
    revalidatePath('/tienda');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al eliminar categoría.' };
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
