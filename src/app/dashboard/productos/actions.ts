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
  if (!user) {
    throw new Error('Sesión no iniciada. Por favor iniciá sesión nuevamente.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'operativo')) {
    throw new Error('Acción no autorizada: Solo los roles Administrador u Operativo pueden realizar esta acción.');
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

    // Registrar movimiento de stock inicial (ajuste/incorporación) si el stock inicial es > 0 (C3.2)
    if (initialStock > 0) {
      const movementRes = await registerStockMovement({
        productId: newProduct.id,
        type: 'ajuste',
        delta: initialStock,
        notes: 'Stock inicial al dar de alta el producto (incorporación preexistente)',
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

async function assertAdminOnly() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Sesión no iniciada. Por favor iniciá sesión nuevamente.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    throw new Error('Acción no autorizada: Solo el Administrador tiene permisos para realizar esta acción.');
  }
  return { user, profile };
}

/**
 * Eliminación de un producto.
 * PostgreSQL decide si se puede borrar (ON DELETE RESTRICT en stock_movements).
 * Si hay dependencias, PostgreSQL rechaza con 23503 y se informa amigablemente
 * la cantidad de movimientos para sugerir archivar en su lugar.
 */
export async function deleteProduct(
  id: string,
  confirmationName: string
): Promise<{ success: boolean; error?: string; canArchive?: boolean }> {
  try {
    const { user, profile } = await assertAdminOnly();

    if (!id || !id.trim()) {
      return { success: false, error: 'ID de producto no válido.' };
    }

    const admin = createAdminClient();

    // Obtener producto completo para snapshot y para verificar nombre de confirmación
    const { data: product, error: fetchErr } = await admin
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !product) {
      return { success: false, error: 'El producto no fue encontrado.' };
    }

    if (confirmationName.trim().toLowerCase() !== product.name.trim().toLowerCase()) {
      return {
        success: false,
        error: `El nombre ingresado no coincide con "${product.name}". Verificá la escritura.`,
      };
    }

    // 1. Verificar dependencias previamente (integridad referencial RESTRICT)
    const { count: movCount } = await admin
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id);

    if (movCount && movCount > 0) {
      return {
        success: false,
        error: `No se puede eliminar porque tiene ${movCount} movimiento(s) de stock asociados. Podés archivarlo.`,
        canArchive: true,
      };
    }

    const { count: batchCount } = await admin
      .from('product_batches')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id);

    if (batchCount && batchCount > 0) {
      return {
        success: false,
        error: `No se puede eliminar porque tiene ${batchCount} lote(s) asociados en inventario. Podés archivarlo.`,
        canArchive: true,
      };
    }

    const { count: orderCount } = await admin
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id);

    if (orderCount && orderCount > 0) {
      return {
        success: false,
        error: `No se puede eliminar porque tiene ${orderCount} pedido(s) web asociados. Podés archivarlo.`,
        canArchive: true,
      };
    }

    // 2. Registro de Auditoría ANTES del borrado (si falla la auditoría, NO se borra)
    const actorName = profile.full_name || user.email || 'Administrador';
    const { error: auditError } = await admin.from('deletion_audit').insert({
      actor_id: user.id,
      actor_name: actorName,
      action: 'eliminado',
      entity_type: 'producto',
      entity_id: id,
      entity_name: product.name,
      reason: 'Eliminación definitiva por Administrador en Dashboard',
      snapshot: product,
    });

    if (auditError) {
      console.error('[AUDIT ERROR PRE-DELETE]', auditError);
      return {
        success: false,
        error: `No se puede eliminar el producto: fallo en el registro obligatorio de auditoría (${auditError.message}). Operación abortada por seguridad.`,
      };
    }

    // 2.1 Limpieza defensiva de dependencias polimórficas huérfanas (Bloque 5)
    // Al ser relaciones polimórficas (entity_id / related_entity_id), PostgreSQL no tiene FK CASCADE.
    try {
      await admin.from('practice_material_links').delete().eq('entity_id', id);
      await admin.from('staff_tasks').delete().eq('related_entity_id', id);
    } catch (cleanErr: any) {
      console.warn('[deleteProduct] Advertencia limpiando dependencias polimórficas:', cleanErr?.message);
    }

    // 3. Ejecutar borrado definitivo en PostgreSQL
    const { error: deleteError } = await admin.from('products').delete().eq('id', id);

    if (deleteError) {
      console.error('[DELETE ERROR]', deleteError);
      return {
        success: false,
        error: `Error al eliminar producto en base de datos: ${deleteError.message}`,
      };
    }

    console.log(`[AUDIT] Producto eliminado: "${product.name}" (ID: ${id}) por ${actorName} (${user.id})`);

    revalidatePath('/dashboard/productos');
    revalidatePath('/tienda');

    return { success: true };
  } catch (err: any) {
    console.error('[deleteProduct] Error:', err);
    return { success: false, error: err?.message || 'Error al procesar la eliminación.' };
  }
}

/**
 * Archivado (desactivación) de producto con auditoría inmutable obligatoria.
 */
export async function archiveProduct(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, profile } = await assertAdminOnly();

    if (!id || !id.trim()) {
      return { success: false, error: 'ID de producto no válido.' };
    }

    const admin = createAdminClient();

    // Obtener producto antes de archivar para snapshot
    const { data: product, error: fetchErr } = await admin
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !product) {
      return { success: false, error: 'Producto no encontrado para archivar.' };
    }

    // 1. Registro obligatorio en deletion_audit antes de actualizar estado
    const actorName = profile.full_name || user.email || 'Administrador';
    const { error: auditError } = await admin.from('deletion_audit').insert({
      actor_id: user.id,
      actor_name: actorName,
      action: 'archivado',
      entity_type: 'producto',
      entity_id: id,
      entity_name: product.name,
      reason: 'Archivado / desactivación manual desde catálogo',
      snapshot: product,
    });

    if (auditError) {
      if (auditError.code === 'PGRST205') {
        console.warn('[AUDIT NOTICE] deletion_audit aún no existe en BD. Procediendo con archivado reversible.');
      } else {
        console.error('[AUDIT ERROR PRE-ARCHIVE]', auditError);
        return {
          success: false,
          error: `No se puede archivar el producto: fallo en el registro obligatorio de auditoría (${auditError.message}).`,
        };
      }
    }

    // 2. Desactivar producto en catálogo
    const { error: updateError } = await admin
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    console.log(`[AUDIT] Producto archivado: ID ${id} por ${actorName} (${user.id})`);

    revalidatePath('/dashboard/productos');
    revalidatePath('/tienda');

    return { success: true };
  } catch (err: any) {
    console.error('[archiveProduct] Error:', err);
    return { success: false, error: err?.message || 'Error al archivar el producto.' };
  }
}

/**
 * Obtener historial inmutable de eliminaciones y archivados (solo admin).
 */
export async function getDeletionAuditLogs(): Promise<{
  success: boolean;
  logs?: Array<{
    id: string;
    occurred_at: string;
    actor_id: string | null;
    actor_name: string;
    action: 'eliminado' | 'archivado' | 'restaurado';
    entity_type: string;
    entity_id: string;
    entity_name: string;
    reason?: string | null;
    snapshot?: Record<string, any>;
  }>;
  tablePending?: boolean;
  error?: string;
}> {
  try {
    await assertAdminOnly();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('deletion_audit')
      .select('*')
      .order('occurred_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        return { success: true, logs: [], tablePending: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true, logs: data || [] };
  } catch (err: any) {
    console.error('[getDeletionAuditLogs] Error:', err);
    return { success: false, error: err?.message || 'Error al obtener registros de auditoría' };
  }
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
    const { user } = await assertAdminOrOperativo();

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
    const { user } = await assertAdminOrOperativo();
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
      author_name: profilesMap[m.created_by] || (m.created_by ? `Usuario (${m.created_by.slice(0, 8)})` : 'Sistema / Personal'),
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
    const previousUrl = (formData.get('previous_url') as string)?.trim();
    const productSlug = (formData.get('slug') as string)?.trim() || 'producto';

    if (!file || typeof file !== 'object' || typeof (file as any).arrayBuffer !== 'function') {
      return { success: false, error: 'No se recibió ningún archivo válido.' };
    }

    const fileType = (file.type || '').toLowerCase();
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileType)) {
      return { success: false, error: 'Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.' };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: 'La imagen excede el límite permitido de 10 MB.' };
    }

    const admin = createAdminClient();

    // Bloque E3: Si se reemplaza una imagen anterior, borrarla del bucket SOLO si apunta a Supabase Storage
    const isSupabaseStorageUrl =
      previousUrl &&
      (previousUrl.includes('supabase.co/storage/v1/object/public/products/') ||
       previousUrl.includes('/storage/v1/object/public/products/'));

    if (isSupabaseStorageUrl) {
      try {
        const parts = previousUrl.split('/products/');
        if (parts.length > 1) {
          const oldFileName = decodeURIComponent(parts[1].split('?')[0]);
          if (oldFileName && !oldFileName.includes('/')) {
            await admin.storage.from('products').remove([oldFileName]);
          }
        }
      } catch (delErr) {
        console.warn('[uploadProductImage] No se pudo borrar la imagen anterior de Supabase Storage:', delErr);
      }
    }

    // Nombrar archivo con el slug del producto + timestamp (sin caracteres extraños ni espacios)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeSlug = slugify(productSlug).replace(/[^a-z0-9_-]/gi, '-');
    const fileName = `${safeSlug}-${Date.now()}.${fileExt}`;
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
      return { success: false, error: `Error al subir la imagen al almacenamiento: ${uploadErr.message}` };
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
    const { user } = await assertAdminOrOperativo();

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

    // Normalizar fechas respetando la zona horaria del consultorio (America/Argentina/Buenos_Aires: UTC-3)
    const startIso = new Date(`${startDateStr}T00:00:00-03:00`).toISOString();
    const endIso = new Date(`${endDateStr}T23:59:59.999-03:00`).toISOString();

    // 1. Obtener TODOS los productos (activos y archivados) para resolver nombres en el libro y clasificar
    const { data: allProducts, error: prodErr } = await admin
      .from('products')
      .select('id, name, category, stock_quantity, is_active')
      .order('name', { ascending: true });

    if (prodErr || !allProducts) {
      return {
        success: false,
        startDate: startDateStr,
        endDate: endDateStr,
        summary: [],
        movements: [],
        allBalanced: false,
        allCatalogSynced: false,
        catalogDiscrepanciesCount: 0,
        totalInitialStock: 0,
        totalFinalStock: 0,
        totalNetChange: 0,
        activeCount: 0,
        archivedCount: 0,
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
        allCatalogSynced: false,
        catalogDiscrepanciesCount: 0,
        totalInitialStock: 0,
        totalFinalStock: 0,
        totalNetChange: 0,
        activeCount: 0,
        archivedCount: 0,
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
    // El nombre del producto SIEMPRE se resuelve contra allProducts (activos y archivados)
    const periodMovements = allMovements
      .filter((m: any) => m.created_at >= startIso && m.created_at <= endIso)
      .map((m: any) => {
        const prod = allProducts.find((p) => p.id === m.product_id);
        const notesStr = m.notes || '';
        const isTest = /^\s*PRUEBA/i.test(notesStr);
        const isAnnulled = /^\s*ANULACI[ÓOóo]N/i.test(notesStr);
        let cleanNotes = notesStr;
        if (isAnnulled) {
          cleanNotes = notesStr.replace(/^\s*ANULACI[ÓOóo]N\s*[-—–:]*\s*/i, '').replace(/^[—–-]\s*/, '').trim();
        } else if (isTest) {
          cleanNotes = notesStr.replace(/^\s*PRUEBA(?:\s+T[ÉEée]CNICA)?\s*[-—–:]*\s*/i, '').replace(/^[—–-]\s*/, '').trim();
        }
        return {
          ...m,
          notes: cleanNotes || notesStr,
          product_name: prod?.name || 'Producto del historial',
          category: prod?.category || '—',
          is_archived: prod ? !prod.is_active : false,
          author_name: profilesMap[m.created_by] || (m.created_by ? `Usuario (${m.created_by.slice(0, 8)})` : 'Sistema / Personal'),
          is_test: isTest,
          is_annulled: isAnnulled,
        };
      })
      .reverse(); // Más recientes primero para la tabla de auditoría

    // 3. Calcular balance consolidado por producto
    // Reglas de negocio de auditoría:
    // a) Producto activo: siempre entra al balance.
    // b) Producto archivado con stock físico distinto de cero: entra al balance, marcado como archivado.
    // c) Producto archivado con stock cero: entra al balance si tuvo movimientos dentro del período para computar sus deltas.
    // d) Producto archivado con stock cero y sin movimientos en el período: queda excluido para no ensuciar.
    const summary: StockReportSummaryItem[] = [];
    let allBalanced = true;
    let allCatalogSynced = true;
    let catalogDiscrepanciesCount = 0;
    let totalInitialStock = 0;
    let totalFinalStock = 0;
    let totalNetChange = 0;

    for (const prod of allProducts) {
      const prodMovs = allMovements.filter((m: any) => m.product_id === prod.id);
      const beforeMovs = prodMovs.filter((m: any) => m.created_at < startIso);
      const duringMovs = prodMovs.filter((m: any) => m.created_at >= startIso && m.created_at <= endIso);

      const hasStock = (prod.stock_quantity ?? 0) !== 0;
      const hasActivityInPeriod = duringMovs.length > 0;

      // Si está inactivo y no tiene stock ni actividad en el período, se omite
      if (!prod.is_active && !hasStock && !hasActivityInPeriod) {
        continue;
      }

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
      let baselineDelta = 0;

      for (const m of duringMovs) {
        const delta = m.quantity_delta ?? 0;
        const notesLower = (m.notes || '').toLowerCase();
        // Reconocer AMBAS convenciones de línea de base inicial:
        // Convención A (productos iniciales): recuento + "línea de base" / "recuento inicial"
        // Convención B (alta desde formulario): ajuste + "stock inicial" / "incorporación preexistente" / "línea de base"
        const isInitialBaseline =
          (m.movement_type === 'recuento' &&
            (notesLower.includes('línea de base') ||
              notesLower.includes('linea de base') ||
              notesLower.includes('recuento inicial'))) ||
          (m.movement_type === 'ajuste' &&
            (notesLower.includes('stock inicial') ||
              notesLower.includes('incorporación preexistente') ||
              notesLower.includes('incorporacion preexistente') ||
              notesLower.includes('alta de producto') ||
              notesLower.includes('línea de base') ||
              notesLower.includes('linea de base')));

        if (isInitialBaseline) {
          baselineDelta += delta;
        } else {
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
      }

      const netChange =
        baselineDelta + purchases + salesOnline + salesCounter + losses + adjustments + recountsDelta;

      let stockFinal = stockInitial;
      if (duringMovs.length > 0) {
        stockFinal = duringMovs[duringMovs.length - 1].stock_after;
      }

      const isBalanced = stockInitial + netChange === stockFinal;
      if (!isBalanced) allBalanced = false;

      const catalogStock = prod.stock_quantity ?? 0;
      const isCatalogSynced = stockFinal === catalogStock;
      const catalogDiff = catalogStock - stockFinal;
      if (!isCatalogSynced) {
        allCatalogSynced = false;
        catalogDiscrepanciesCount++;
      }

      totalInitialStock += stockInitial;
      totalFinalStock += stockFinal;
      totalNetChange += netChange;

      summary.push({
        productId: prod.id,
        productName: prod.name,
        category: prod.category || 'General',
        isArchived: !prod.is_active,
        stockInitial,
        baselineDelta,
        purchases,
        salesOnline,
        salesCounter,
        losses,
        adjustments,
        recountsDelta,
        netChange,
        stockFinal,
        isBalanced,
        catalogStock,
        catalogDiff,
        isCatalogSynced,
      });
    }

    const activeCount = summary.filter((s) => !s.isArchived).length;
    const archivedCount = summary.filter((s) => s.isArchived).length;

    return {
      success: true,
      startDate: startDateStr,
      endDate: endDateStr,
      summary,
      movements: periodMovements,
      allBalanced,
      allCatalogSynced,
      catalogDiscrepanciesCount,
      totalInitialStock,
      totalFinalStock,
      totalNetChange,
      activeCount,
      archivedCount,
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
      allCatalogSynced: false,
      catalogDiscrepanciesCount: 0,
      totalInitialStock: 0,
      totalFinalStock: 0,
      totalNetChange: 0,
      error: err?.message || 'Error al generar el reporte de stock.',
    };
  }
}

/**
 * Identifica productos activos con stock 0 que no tienen ningún movimiento en el libro (C4)
 */
export async function getPendingBaselineProductIds(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data: prods } = await admin
      .from('products')
      .select('id, stock_quantity')
      .eq('is_active', true)
      .eq('stock_quantity', 0);

    if (!prods || prods.length === 0) return [];

    const prodIds = prods.map((p) => p.id);
    const { data: movs } = await admin
      .from('stock_movements')
      .select('product_id')
      .in('product_id', prodIds);

    const productsWithMovements = new Set((movs || []).map((m: any) => m.product_id));
    return prodIds.filter((id) => !productsWithMovements.has(id));
  } catch {
    return [];
  }
}


