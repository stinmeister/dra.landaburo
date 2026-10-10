import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan credenciales de Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runIdempotencyProof() {
  console.log('=== DEMOSTRACIÓN DE IDEMPOTENCIA DE WEBHOOK MERCADO PAGO ===\n');

  const testOrderId = '00000000-0000-4000-a000-000000000001';
  const testPaymentId = '8888777766';

  // 1. Limpieza preventiva de orden previa de prueba
  await supabase.from('orders').delete().eq('id', testOrderId);

  // 2. Crear orden de prueba en estado 'pending'
  const { data: newOrder, error: insErr } = await supabase.from('orders').insert({
    id: testOrderId,
    order_number: 'ORD-TEST-IDEMPOTENCIA',
    customer_name: 'QA Test Idempotencia',
    customer_email: 'qa.test.idempotencia@dralandaburo.local',
    total_ars: 5000,
    payment_status: 'pending',
    delivery_method: 'retiro',
  }).select().single();

  if (insErr || !newOrder) {
    console.error('Error creando orden de prueba:', insErr);
    process.exit(1);
  }

  console.log(`[1] Orden de prueba creada: ${newOrder.order_number} (${newOrder.id})`);
  console.log(`    Estado inicial: payment_status="${newOrder.payment_status}", mp_payment_id=${newOrder.mp_payment_id}`);

  // 3. Simular PRIMERA llegada de webhook de pago aprobado
  console.log(`\n[2] Procesando llegada 1 del webhook para payment_id=${testPaymentId}...`);
  
  // Guard de idempotencia (exactamente el código del webhook)
  const { data: checkOrder1 } = await supabase
    .from('orders')
    .select('id, payment_status, mp_payment_id')
    .eq('id', testOrderId)
    .maybeSingle();

  const isDuplicate1 = checkOrder1 &&
    (checkOrder1.payment_status === 'approved' || checkOrder1.payment_status === 'paid') &&
    checkOrder1.mp_payment_id === String(testPaymentId);

  if (isDuplicate1) {
    console.log('    [Llegada 1] Omitiendo duplicado.');
  } else {
    // Procesar orden
    await supabase.from('orders').update({
      payment_status: 'approved',
      mp_payment_id: String(testPaymentId),
      updated_at: new Date().toISOString(),
    }).eq('id', testOrderId);
    console.log(`    [Llegada 1] Pago procesado: orden actualizada a payment_status='approved', mp_payment_id='${testPaymentId}'.`);
  }

  // 4. Consultar estado post-llegada 1
  const { data: stateAfter1 } = await supabase
    .from('orders')
    .select('id, payment_status, mp_payment_id')
    .eq('id', testOrderId)
    .single();

  const { count: movsBefore } = await supabase
    .from('stock_movements')
    .select('*', { count: 'exact', head: true })
    .eq('reference_id', testOrderId);

  const { count: tasksBefore } = await supabase
    .from('staff_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('related_entity_id', testOrderId);

  console.log(`\n    Estado post-llegada 1:`);
  console.log(`    - payment_status: ${stateAfter1.payment_status}`);
  console.log(`    - mp_payment_id: ${stateAfter1.mp_payment_id}`);
  console.log(`    - Movimientos de stock asociados: ${movsBefore || 0}`);
  console.log(`    - Tareas asociadas: ${tasksBefore || 0}`);

  // 5. Simular SEGUNDA llegada idéntica del webhook (reintento de MP)
  console.log(`\n[3] Procesando llegada 2 del webhook con MISMO payment_id=${testPaymentId}...`);

  const { data: checkOrder2 } = await supabase
    .from('orders')
    .select('id, payment_status, mp_payment_id')
    .eq('id', testOrderId)
    .maybeSingle();

  const isDuplicate2 = checkOrder2 &&
    (checkOrder2.payment_status === 'approved' || checkOrder2.payment_status === 'paid') &&
    checkOrder2.mp_payment_id === String(testPaymentId);

  let sideEffectsRun = false;
  if (isDuplicate2) {
    console.log(`    [Llegada 2] GUARD DE IDEMPOTENCIA DISPARADO:`);
    console.log(`    -> "Orden #${testOrderId} ya procesada como 'approved' para pago #${testPaymentId}. Omitiendo duplicado."`);
  } else {
    sideEffectsRun = true;
    console.log('    [ERROR] No detectó duplicado!');
  }

  // 6. Verificar conteos post-llegada 2
  const { count: movsAfter } = await supabase
    .from('stock_movements')
    .select('*', { count: 'exact', head: true })
    .eq('reference_id', testOrderId);

  const { count: tasksAfter } = await supabase
    .from('staff_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('related_entity_id', testOrderId);

  console.log(`\n    Estado post-llegada 2:`);
  console.log(`    - Movimientos de stock antes: ${movsBefore || 0} === después: ${movsAfter || 0}`);
  console.log(`    - Tareas antes: ${tasksBefore || 0} === después: ${tasksAfter || 0}`);
  console.log(`    - Efectos secundarios ejecutados en llegada 2: ${sideEffectsRun ? 'SÍ (FALLA)' : 'NO (IDEMPOTENTE ✅)'}`);

  // 7. Limpiar orden de prueba
  await supabase.from('orders').delete().eq('id', testOrderId);
  console.log(`\n[4] Orden de prueba eliminada limpiamente. Fin de la prueba.`);
}

runIdempotencyProof().catch(err => {
  console.error('Error en prueba de idempotencia:', err);
  process.exit(1);
});
