'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  registerStockMovement,
  type StockMovementType,
  type MonthlyCountInput,
  type StockReportSummaryItem,
  type StockReportData,
} from '@/lib/stock/registerMovement';

async function assertStaffCanManageProducts() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Sesión no iniciada. Por favor iniciá sesión nuevamente.');
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role === 'paciente') {
    throw new Error('Sin permisos para gestionar inventario.');
  }
  const staffAllowed = ['admin', 'operativo', 'cosmetologa', 'medico'];
  if (!staffAllowed.includes(profile.role)) {
    throw new Error('Rol no autorizado para gestionar inventario.');
  }
  return { user, profile };
}

async function assertAdminOrOperativo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'operativo')) {
    throw new Error('Acción reservada para roles de administración u operativo.');
  }
  return { user, profile };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Alta de un nuevo producto en el catálogo.
 * Resuelve A2: Valida campos obligatorios, respeta brand_type NOT NULL,
 * permite price_ars nullable, asigna category_id y registra movimiento de línea de base inicial.
 */
export async function createProduct(
  formData: FormData
): Promise<{ success: boolean; error?: string; product?: any }> {
  try {
    const { user } = await assertAdminOrOperativo();

    const name = (formData.get('name') as string)?.trim();
    const rawCategoryId = (formData.get('category_id') as string)?.trim();
    const rawCategory = (formData.get('category') as string)?.trim();
    const rawPrice = formData.get('price_ars');
    const rawStock = formData.get('stock_quantity');
    const rawMinStock = formData.get('min_stock_alert');
    const description = (formData.get('description') as string)?.trim() ?? '';
    const image_url = (formData.get('image_url') as string)?.trim() ?? null;
    const rawBrand = (formData.get('brand_type') as string)?.trim();
    const isPublic = formData.get('is_public') !== 'false';

    if (!name) {
      return { success: false, error: 'El nombre del producto es obligatorio.' };
    }

    const price_ars =
      rawPrice !== null && rawPrice !== '' && !isNaN(parseFloat(rawPrice as string))
        ? parseFloat(rawPrice as string)
        : null;

    const initialStock =
      rawStock !== null && rawStock !== '' && !isNaN(parseInt(rawStock as string, 10))
        ? Math.max(0, parseInt(rawStock as string, 10))
        : 0;

    const min_stock_alert =
      rawMinStock !== null && rawMinStock !== '' && !isNaN(parseInt(rawMinStock as string, 10))
        ? parseInt(rawMinStock as string, 10)
        : 5;

    const brand_type = rawBrand || 'Dra. Landaburo';
    const slug = slugify(name);

    const admin = createAdminClient();

    // Resolver category_id y category (texto de respaldo)
    let categoryId: string | null = null;
    let categoryName: string = 'Suplementos';

    if (rawCategoryId) {
      const { data: catRow } = await admin
        .from('product_categories')
        .select('id, name')
        .eq('id', rawCategoryId)
        .maybeSingle();

      if (catRow) {
        categoryId = catRow.id;
        categoryName = catRow.name;
      }
    } else if (rawCategory) {
      const { data: catRow } = await admin
        .from('product_categories')
        .select('id, name')
        .ilike('name', rawCategory)
        .maybeSingle();

      if (catRow) {
        categoryId = catRow.id;
        categoryName = catRow.name;
      } else {
        categoryName = rawCategory;
      }
    }

    const insertData: any = {
      name,
      slug,
      description: description || null,
      brand_type,
      category: categoryName,
      category_id: categoryId,
      price_ars,
      stock_quantity: 0, // Se inicializa en 0 y luego el movimiento recuento establece el valor
      min_stock_alert,
      image_url,
      is_active: true,
      is_public: isPublic,
    };

    const { data: newProduct, error: insErr } = await admin
      .from('products')
      .insert(insertData)
      .select('id, name, slug, stock_quantity, price_ars, category, is_public')
      .single();

    if (insErr || !newProduct) {
      console.error('[createProduct] Error de base de datos:', insErr);
      return {
        success: false,
        error: `Error al crear el producto: ${insErr?.message || 'Error desconocido'}`,
      };
    }

    // Registrar movimiento de recuento inicial (línea de base) si el stock inicial es > 0
    if (initialStock > 0) {
      const movementRes = await registerStockMovement({
        productId: newProduct.id,
        type: 'recuento',
        countedQty: initialStock,
        notes: 'Recuento inicial — línea de base al dar de alta el producto',
        userId: user.id,
      });

      if (!movementRes.ok) {
        console.warn('[createProduct] Producto creado pero falló el movimiento inicial:', movementRes.error);
      }
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/operativo');
    revalidatePath('/tienda');

    return { success: true, product: newProduct };
  } catch (err: any) {
    console.error('[createProduct] Excepción:', err);
    return { success: false, error: err?.message || 'Ocurrió un error inesperado al crear el producto.' };
  }
}

export async function toggleProduct(formData: FormData) {
  await assertAdminOrOperativo();

  const id = formData.get('id') as string;
  const isActive = formData.get('is_active') === 'true';

  if (!id) return;

  const admin = createAdminClient();
  await admin.from('products').update({ is_active: !isActive }).eq('id', id);

  revalidatePath('/dashboard/productos');
  revalidatePath('/tienda');
}

/**
 * Modificación rápida de stock (+1 / -1) desde la tabla de productos.
 * Utiliza exclusivamente registerStockMovement:
 * - Delta +1: tipo 'compra'
 * - Delta -1: tipo 'venta_mostrador'
 */
export async function updateStock(
  targetOrFormData: string | FormData,
  maybeDelta?: number,
  notes?: string
): Promise<{ success: boolean; newStock?: number; error?: string }> {
  try {
    const { user } = await assertStaffCanManageProducts();

    let id: string = '';
    let delta: number = 0;

    if (typeof targetOrFormData === 'string') {
      id = targetOrFormData.trim();
      delta = typeof maybeDelta === 'number' ? maybeDelta : 0;
    } else if (
      targetOrFormData instanceof FormData ||
      (targetOrFormData && typeof (targetOrFormData as any).get === 'function')
    ) {
      id = ((targetOrFormData.get('id') as string) || '').trim();
      delta = parseInt((targetOrFormData.get('delta') as string) || '0', 10);
    } else if (typeof targetOrFormData === 'object' && targetOrFormData !== null) {
      id = ((targetOrFormData as any).id || '').trim();
      delta = Number((targetOrFormData as any).delta) || 0;
    }

    if (!id || isNaN(delta) || delta === 0) {
      return { success: false, error: 'Parámetros inválidos para actualizar stock.' };
    }

    const movementType: StockMovementType = delta > 0 ? 'compra' : 'venta_mostrador';

    const result = await registerStockMovement({
      productId: id,
      type: movementType,
      delta: Math.abs(delta),
      notes: notes || (delta > 0 ? 'Reposición rápida (+1)' : 'Venta mostrador rápida (-1)'),
      userId: user.id,
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/operativo');
    revalidatePath('/tienda');

    return { success: true, newStock: result.stockAfter };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar el stock.' };
  }
}

/**
 * Ajuste explícito de stock con tipo y motivo desde el modal.
 */
export async function adjustStockWithMovement(
  productId: string,
  type: StockMovementType,
  deltaOrCounted: number,
  notes?: string
): Promise<{ success: boolean; newStock?: number; error?: string }> {
  try {
    const { user } = await assertStaffCanManageProducts();
    const id = (productId || '').trim();

    if (!id) {
      return { success: false, error: 'ID de producto inválido.' };
    }

    let result;
    if (type === 'recuento') {
      result = await registerStockMovement({
        productId: id,
        type: 'recuento',
        countedQty: deltaOrCounted,
        notes: notes || 'Recuento físico puntual',
        userId: user.id,
      });
    } else {
      result = await registerStockMovement({
        productId: id,
        type,
        delta: deltaOrCounted,
        notes,
        userId: user.id,
      });
    }

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/operativo');
    revalidatePath('/tienda');

    return { success: true, newStock: result.stockAfter };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al registrar el movimiento.' };
  }
}

/**
 * Obtener historial de movimientos de un producto desde stock_movements.
 */
export async function getStockMovements(productId: string): Promise<{
  success: boolean;
  movements: any[];
  error?: string;
}> {
  try {
    await assertStaffCanManageProducts();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('stock_movements')
      .select(`
        id,
        product_id,
        movement_type,
        quantity_delta,
        stock_before,
        stock_after,
        counted_qty,
        expected_qty,
        notes,
        created_at,
        created_by,
        reference_type,
        reference_id
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return { success: false, movements: [], error: error.message };
    }

    // Traer nombres de los autores desde profiles
    const userIds = Array.from(new Set((data || []).map((m: any) => m.created_by).filter(Boolean)));
    let profilesMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      (profs || []).forEach((p: any) => {
        profilesMap[p.id] = p.full_name || 'Personal';
      });
    }

    const enriched = (data || []).map((m: any) => ({
      ...m,
      author_name: profilesMap[m.created_by] || 'Sistema / Personal',
    }));

    return { success: true, movements: enriched };
  } catch (err: any) {
    return { success: false, movements: [], error: err?.message };
  }
}

/**
 * Edición de datos generales de un producto.
 */
export async function updateProduct(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await assertAdminOrOperativo();

    const id = (formData.get('id') as string)?.trim();
    const name = (formData.get('name') as string)?.trim();
    const rawCategoryId = (formData.get('category_id') as string)?.trim();
    const rawCategory = (formData.get('category') as string)?.trim();
    const rawPrice = formData.get('price_ars');
    const rawMinStock = formData.get('min_stock_alert');
    const description = (formData.get('description') as string)?.trim() ?? '';
    const image_url = (formData.get('image_url') as string)?.trim() ?? null;
    const isPublic = formData.get('is_public') !== 'false';

    if (!id || !name) {
      return { success: false, error: 'El ID y el nombre del producto son obligatorios.' };
    }

    const price_ars =
      rawPrice !== null && rawPrice !== '' && !isNaN(parseFloat(rawPrice as string))
        ? parseFloat(rawPrice as string)
        : null;

    const min_stock_alert =
      rawMinStock !== null && rawMinStock !== '' && !isNaN(parseInt(rawMinStock as string, 10))
        ? parseInt(rawMinStock as string, 10)
        : 5;

    const admin = createAdminClient();

    // Resolver category_id y category (texto de respaldo)
    let categoryId: string | null = null;
    let categoryName: string = rawCategory || 'Suplementos';

    if (rawCategoryId) {
      const { data: catRow } = await admin
        .from('product_categories')
        .select('id, name')
        .eq('id', rawCategoryId)
        .maybeSingle();

      if (catRow) {
        categoryId = catRow.id;
        categoryName = catRow.name;
      }
    }

    const updateData: any = {
      name,
      category: categoryName,
      category_id: categoryId,
      price_ars,
      min_stock_alert,
      description: description || null,
      image_url: image_url || null,
      is_public: isPublic,
    };

    const { error: updErr } = await admin.from('products').update(updateData).eq('id', id);
    if (updErr) {
      return { success: false, error: `Error al actualizar producto: ${updErr.message}` };
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
  categories: Array<{ id: string; name: string; slug: string; is_active: boolean; display_order: number; product_count: number }>;
  error?: string;
}> {
  try {
    const admin = createAdminClient();
    const { data: dbCategories, error } = await admin
      .from('product_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      return { success: false, categories: [], error: error.message };
    }

    // Contar productos por categoría
    const { data: prods } = await admin.from('products').select('category_id, category');

    const counts: Record<string, number> = {};
    (prods || []).forEach((p: any) => {
      if (p.category_id) {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      } else if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });

    return {
      success: true,
      categories: (dbCategories || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        is_active: c.is_active,
        display_order: c.display_order ?? 100,
        product_count: counts[c.id] || counts[c.name] || 0,
      })),
    };
  } catch (err: any) {
    return { success: false, categories: [], error: err?.message };
  }
}

export async function createCategory(
  name: string,
  display_order?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdminOrOperativo();
    const trimmed = name.trim();
    if (!trimmed) return { success: false, error: 'El nombre de la categoría es obligatorio.' };

    const admin = createAdminClient();
    const slug = slugify(trimmed);
    const { error } = await admin.from('product_categories').insert({
      name: trimmed,
      slug,
      display_order: typeof display_order === 'number' ? display_order : 50,
      is_active: true,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/tienda');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al crear la categoría.' };
  }
}

export async function updateCategory(
  id: string,
  newName: string,
  display_order?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdminOrOperativo();
    const trimmed = newName.trim();
    if (!id || !trimmed) return { success: false, error: 'Parámetros inválidos para renombrar categoría.' };

    const admin = createAdminClient();
    const slug = slugify(trimmed);

    const updatePayload: any = { name: trimmed, slug };
    if (typeof display_order === 'number') {
      updatePayload.display_order = display_order;
    }

    const { error: updErr } = await admin
      .from('product_categories')
      .update(updatePayload)
      .eq('id', id);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    // Actualizar nombre de respaldo en products
    await admin.from('products').update({ category: trimmed }).eq('category_id', id);

    revalidatePath('/dashboard/productos');
    revalidatePath('/tienda');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al renombrar categoría.' };
  }
}

export async function toggleCategory(
  id: string,
  currentActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdminOrOperativo();
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

export async function deleteCategory(
  id: string,
  categoryName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdminOrOperativo();
    if (!id) return { success: false, error: 'ID de categoría no válido.' };

    const admin = createAdminClient();

    // Bloque E: No permitir borrar una categoría que tenga productos asociados
    const { count: countById } = await admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    const { count: countByName } = await admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category', categoryName);

    const totalCount = Math.max(countById || 0, countByName || 0);

    if (totalCount > 0) {
      return {
        success: false,
        error: `No se puede eliminar "${categoryName}" porque tiene ${totalCount} producto(s) asignado(s). Podés desactivarla para que no se ofrezca en nuevos productos.`,
      };
    }

    const { error } = await admin.from('product_categories').delete().eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/productos');
    revalidatePath('/tienda');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al eliminar categoría.' };
  }
}

export async function uploadProductImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await assertAdminOrOperativo();

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

// ─── Recuento Mensual de Stock ───────────────────────────────────────────────

export async function submitMonthlyCount(
  counts: MonthlyCountInput[]
): Promise<{ success: boolean; results?: any[]; error?: string }> {
  try {
    const { user } = await assertStaffCanManageProducts();

    if (!Array.isArray(counts) || counts.length === 0) {
      return { success: false, error: 'No se recibieron datos de recuento.' };
    }

    const results: any[] = [];
    for (const item of counts) {
      if (!item.productId || typeof item.countedQty !== 'number' || isNaN(item.countedQty) || item.countedQty < 0) {
        continue;
      }

      const res = await registerStockMovement({
        productId: item.productId,
        type: 'recuento',
        countedQty: Math.floor(item.countedQty),
        notes: item.notes?.trim() || 'Recuento físico mensual de inventario',
        userId: user.id,
      });

      results.push({
        productId: item.productId,
        success: res.ok,
        stockBefore: res.stockBefore,
        stockAfter: res.stockAfter,
        delta: res.quantityDelta,
        error: res.error,
      });
    }

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/productos/recuento');
    revalidatePath('/dashboard/productos/movimientos');
    revalidatePath('/dashboard/operativo');
    revalidatePath('/tienda');

    return { success: true, results };
  } catch (err: any) {
    console.error('[submitMonthlyCount Error]:', err);
    return { success: false, error: err?.message || 'Error al registrar el recuento mensual.' };
  }
}

// ─── Reporte de Movimientos de Fecha a Fecha ─────────────────────────────────

export async function getStockReportData(
  startDateStr: string,
  endDateStr: string
): Promise<StockReportData> {
  try {
    await assertStaffCanManageProducts();
    const admin = createAdminClient();

    // Normalizar fechas: inicio a las 00:00:00 y fin a las 23:59:59.999
    const startObj = new Date(startDateStr);
    startObj.setHours(0, 0, 0, 0);
    const startIso = startObj.toISOString();

    const endObj = new Date(endDateStr);
    endObj.setHours(23, 59, 59, 999);
    const endIso = endObj.toISOString();

    // 1. Obtener todos los productos
    const { data: products, error: prodErr } = await admin
      .from('products')
      .select('id, name, category, stock_quantity')
      .order('name', { ascending: true });

    if (prodErr || !products) {
      return {
        success: false,
        startDate: startDateStr,
        endDate: endDateStr,
        summary: [],
        movements: [],
        allBalanced: false,
        totalInitialStock: 0,
        totalFinalStock: 0,
        totalNetChange: 0,
        error: prodErr?.message || 'Error al obtener productos',
      };
    }

    // 2. Obtener movimientos hasta endIso
    const { data: movementsData, error: movErr } = await admin
      .from('stock_movements')
      .select(`
        id,
        product_id,
        movement_type,
        quantity_delta,
        stock_before,
        stock_after,
        counted_qty,
        expected_qty,
        notes,
        created_at,
        created_by,
        reference_type,
        reference_id
      `)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true });

    if (movErr) {
      return {
        success: false,
        startDate: startDateStr,
        endDate: endDateStr,
        summary: [],
        movements: [],
        allBalanced: false,
        totalInitialStock: 0,
        totalFinalStock: 0,
        totalNetChange: 0,
        error: movErr.message,
      };
    }

    const allMovements = movementsData || [];

    // Mapear autores desde profiles
    const userIds = Array.from(new Set(allMovements.map((m: any) => m.created_by).filter(Boolean)));
    const profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', userIds);
      (profs || []).forEach((p: any) => {
        profilesMap[p.id] = p.full_name || 'Personal';
      });
    }

    // Movimientos del período (para tabla cronológica detallada)
    const periodMovements = allMovements
      .filter((m: any) => m.created_at >= startIso && m.created_at <= endIso)
      .map((m: any) => {
        const prod = products.find((p) => p.id === m.product_id);
        return {
          ...m,
          product_name: prod?.name || 'Producto eliminado',
          category: prod?.category || '—',
          author_name: profilesMap[m.created_by] || 'Sistema / Personal',
        };
      })
      .reverse(); // Más recientes primero para la tabla de auditoría

    // 3. Calcular balance consolidado por producto
    const summary: StockReportSummaryItem[] = [];
    let allBalanced = true;
    let totalInitialStock = 0;
    let totalFinalStock = 0;
    let totalNetChange = 0;

    for (const prod of products) {
      const prodMovs = allMovements.filter((m: any) => m.product_id === prod.id);
      const beforeMovs = prodMovs.filter((m: any) => m.created_at < startIso);
      const duringMovs = prodMovs.filter((m: any) => m.created_at >= startIso && m.created_at <= endIso);

      // Determinar stock inicial
      let stockInitial = 0;
      if (beforeMovs.length > 0) {
        stockInitial = beforeMovs[beforeMovs.length - 1].stock_after;
      } else if (duringMovs.length > 0) {
        stockInitial = duringMovs[0].stock_before;
      } else {
        // Sin movimientos previos ni en período
        stockInitial = prod.stock_quantity ?? 0;
      }

      // Sumatorias por tipo dentro del período
      let purchases = 0;
      let salesOnline = 0;
      let salesCounter = 0;
      let losses = 0;
      let adjustments = 0;
      let recountsDelta = 0;

      for (const m of duringMovs) {
        const delta = m.quantity_delta ?? 0;
        switch (m.movement_type) {
          case 'compra':
            purchases += delta;
            break;
          case 'venta_online':
            salesOnline += delta;
            break;
          case 'venta_mostrador':
            salesCounter += delta;
            break;
          case 'baja':
            losses += delta;
            break;
          case 'ajuste':
            adjustments += delta;
            break;
          case 'recuento':
            recountsDelta += delta;
            break;
          default:
            adjustments += delta;
            break;
        }
      }

      const netChange = purchases + salesOnline + salesCounter + losses + adjustments + recountsDelta;
      
      let stockFinal = stockInitial;
      if (duringMovs.length > 0) {
        stockFinal = duringMovs[duringMovs.length - 1].stock_after;
      }

      const isBalanced = (stockInitial + netChange) === stockFinal;
      if (!isBalanced) allBalanced = false;

      totalInitialStock += stockInitial;
      totalFinalStock += stockFinal;
      totalNetChange += netChange;

      summary.push({
        productId: prod.id,
        productName: prod.name,
        category: prod.category || 'General',
        stockInitial,
        purchases,
        salesOnline,
        salesCounter,
        losses,
        adjustments,
        recountsDelta,
        netChange,
        stockFinal,
        isBalanced,
      });
    }

    return {
      success: true,
      startDate: startDateStr,
      endDate: endDateStr,
      summary,
      movements: periodMovements,
      allBalanced,
      totalInitialStock,
      totalFinalStock,
      totalNetChange,
    };
  } catch (err: any) {
    console.error('[getStockReportData Error]:', err);
    return {
      success: false,
      startDate: startDateStr,
      endDate: endDateStr,
      summary: [],
      movements: [],
      allBalanced: false,
      totalInitialStock: 0,
      totalFinalStock: 0,
      totalNetChange: 0,
      error: err?.message || 'Error al generar el reporte de stock.',
    };
  }
}

