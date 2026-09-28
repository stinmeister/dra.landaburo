import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type StockMovementType =
  | 'venta_online'
  | 'venta_mostrador'
  | 'compra'
  | 'baja'
  | 'recuento'
  | 'ajuste';

export interface RegisterMovementParams {
  productId: string;
  type: StockMovementType;
  delta?: number;
  countedQty?: number;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
  userId?: string; // Opcional, si no se pasa se obtiene de la sesión activa
}

export interface RegisterMovementResult {
  ok: boolean;
  movementId?: string;
  stockBefore?: number;
  stockAfter?: number;
  quantityDelta?: number;
  error?: string;
}

export interface MonthlyCountInput {
  productId: string;
  countedQty: number;
  notes?: string;
}

export interface StockReportSummaryItem {
  productId: string;
  productName: string;
  category: string;
  stockInitial: number;
  purchases: number;
  salesOnline: number;
  salesCounter: number;
  losses: number;
  adjustments: number;
  recountsDelta: number;
  netChange: number;
  stockFinal: number;
  isBalanced: boolean;
}

export interface StockReportData {
  success: boolean;
  startDate: string;
  endDate: string;
  summary: StockReportSummaryItem[];
  movements: any[];
  allBalanced: boolean;
  totalInitialStock: number;
  totalFinalStock: number;
  totalNetChange: number;
  error?: string;
}

/**
 * Función central y única de escritura de stock e historial de movimientos.
 * Reglas de negocio:
 * 1. El stock se calcula a partir del libro de movimientos.
 * 2. products.stock_quantity se actualiza como caché de lectura rápida.
 * 3. Se valida que el stock resultante no sea negativo (salvo en ajuste o recuento).
 * 4. Motivo obligatorio en 'baja' y 'ajuste'.
 * 5. Inserción estricta respetando columnas reales: stock_before, stock_after, quantity_delta, counted_qty, expected_qty.
 */
export async function registerStockMovement(
  params: RegisterMovementParams
): Promise<RegisterMovementResult> {
  const { productId, type, delta, countedQty, notes, referenceType, referenceId } = params;

  if (!productId) {
    return { ok: false, error: 'ID de producto no proporcionado.' };
  }

  // 1. Determinar usuario autor
  let authorUserId = params.userId;
  if (!authorUserId) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        authorUserId = user.id;
      }
    } catch {
      // Entorno sin cookies (ej. webhook background)
    }
  }

  const admin = createAdminClient();

  if (!authorUserId) {
    // Si no hay sesión (webhook servidor), obtener el ID del usuario administrador principal
    const { data: adminProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    authorUserId = adminProfile?.id || '929d7198-8506-4a06-b730-115cd89ce8ee';
  }

  // 2. Validación de motivo obligatorio en 'baja' y 'ajuste'
  if ((type === 'baja' || type === 'ajuste') && (!notes || notes.trim().length === 0)) {
    return {
      ok: false,
      error: `El motivo es obligatorio para registrar un movimiento de tipo ${type === 'baja' ? 'Baja' : 'Ajuste'}.`,
    };
  }

  // 3. Idempotencia para órdenes online si se proporciona reference_id
  if (type === 'venta_online' && referenceType === 'order' && referenceId) {
    const { data: existingMovement } = await admin
      .from('stock_movements')
      .select('id, stock_after')
      .eq('product_id', productId)
      .eq('reference_type', 'order')
      .eq('reference_id', referenceId)
      .maybeSingle();

    if (existingMovement) {
      console.log(`[registerStockMovement] Movimiento ya registrado para orden ${referenceId} y producto ${productId}. Omitiendo.`);
      return {
        ok: true,
        movementId: existingMovement.id,
        stockAfter: existingMovement.stock_after,
        error: undefined,
      };
    }
  }

  // 4. Obtener stock actual del producto
  const { data: product, error: fetchErr } = await admin
    .from('products')
    .select('id, name, stock_quantity')
    .eq('id', productId)
    .single();

  if (fetchErr || !product) {
    return { ok: false, error: `Producto no encontrado: ${fetchErr?.message || 'ID inexistente'}` };
  }

  const stockBefore = product.stock_quantity ?? 0;
  let stockAfter = stockBefore;
  let finalDelta = 0;
  let finalCountedQty: number | null = null;
  let finalExpectedQty: number | null = null;

  // 5. Cálculo según el tipo de movimiento
  if (type === 'recuento') {
    if (countedQty === undefined || isNaN(countedQty)) {
      return { ok: false, error: 'En un recuento es obligatorio indicar la cantidad contada (countedQty).' };
    }
    finalExpectedQty = stockBefore;
    finalCountedQty = countedQty;
    finalDelta = countedQty - stockBefore;
    stockAfter = countedQty;
  } else {
    if (delta === undefined || isNaN(delta)) {
      return { ok: false, error: `El movimiento de tipo '${type}' requiere un valor de delta numérico.` };
    }

    // Normalizar signo del delta según el tipo
    if (type === 'venta_online' || type === 'venta_mostrador' || type === 'baja') {
      finalDelta = -Math.abs(delta);
    } else if (type === 'compra') {
      finalDelta = Math.abs(delta);
    } else {
      // 'ajuste' puede ser positivo o negativo
      finalDelta = delta;
    }

    stockAfter = stockBefore + finalDelta;

    // Validación de stock no negativo (excepto en ajuste o recuento)
    if (stockAfter < 0 && type !== 'ajuste') {
      const cantSolicitada = Math.abs(finalDelta);
      return {
        ok: false,
        error: `No podés descontar ${cantSolicitada} ${cantSolicitada === 1 ? 'unidad' : 'unidades'}: hay ${stockBefore} en stock de "${product.name}".`,
      };
    }
  }

  // 6. Insertar movimiento en stock_movements
  const insertPayload: any = {
    product_id: productId,
    movement_type: type,
    quantity_delta: finalDelta,
    stock_before: stockBefore,
    stock_after: stockAfter,
    counted_qty: finalCountedQty,
    expected_qty: finalExpectedQty,
    created_by: authorUserId,
    reference_type: referenceType || null,
    reference_id: referenceId || null,
    notes: notes?.trim() || null,
  };

  const { data: movement, error: insertErr } = await admin
    .from('stock_movements')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertErr || !movement) {
    console.error('[registerStockMovement] Error insertando en stock_movements:', insertErr);
    return {
      ok: false,
      error: `Error al registrar el movimiento en el libro de stock: ${insertErr?.message || 'Fallo desconocido'}`,
    };
  }

  // 7. Actualizar caché products.stock_quantity
  const { error: updateErr } = await admin
    .from('products')
    .update({ stock_quantity: stockAfter })
    .eq('id', productId);

  if (updateErr) {
    console.error('[registerStockMovement] Error actualizando stock_quantity en products:', updateErr);
    return {
      ok: false,
      error: `El movimiento se registró (#${movement.id}) pero falló la actualización del caché de productos: ${updateErr.message}`,
    };
  }

  return {
    ok: true,
    movementId: movement.id,
    stockBefore,
    stockAfter,
    quantityDelta: finalDelta,
  };
}
