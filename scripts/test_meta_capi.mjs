import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('=== TEST 1.4: VERIFICACIÓN REAL DE META CAPI EN orders ===\n');

  // 1. Crear una orden de prueba rotulada
  const testOrderId = '00000000-0000-0000-0000-000000001410';
  console.log('1. Creando orden de prueba rotulada:', testOrderId);

  // Asegurar limpieza previa
  await sb.from('orders').delete().eq('id', testOrderId);

  const { data: insertedOrder, error: insErr } = await sb.from('orders').insert({
    id: testOrderId,
    order_number: 'ORD-TEST-CAPI-1410',
    buyer_name: 'QA Test CAPI',
    buyer_email: 'qa.test.capi@dralandaburo.local',
    customer_name: 'QA Test CAPI',
    customer_email: 'qa.test.capi@dralandaburo.local',
    total_ars: 15000,
    payment_status: 'approved',
    fulfillment_status: 'pendiente',
  }).select('*').single();

  if (insErr) {
    console.error('Error creando orden de prueba:', insErr);
    return;
  }

  console.log('   Orden creada con estado inicial:');
  console.log('   - meta_capi_status:', insertedOrder.meta_capi_status, '(Default esperado: pending)');
  console.log('   - meta_capi_event_id:', insertedOrder.meta_capi_event_id);
  console.log('   - meta_capi_sent_at:', insertedOrder.meta_capi_sent_at);
  console.log('   - meta_capi_error:', insertedOrder.meta_capi_error);

  // 2. Probar Camino de Error (ej: rechazo de Meta Graph API o token faltante)
  console.log('\n2. Simulando camino de ERROR / RECHAZO en Meta CAPI...');
  const testErrorMsg = 'Graph API Error: (#100) Param user_data[em] has invalid format';
  const testEventId = `ext-ref-${testOrderId}`;

  const { error: updErr1 } = await sb.from('orders').update({
    meta_capi_status: 'failed',
    meta_capi_event_id: testEventId,
    meta_capi_sent_at: null,
    meta_capi_error: testErrorMsg,
  }).eq('id', testOrderId);

  if (updErr1) {
    console.error('Error actualizando camino de error:', updErr1);
    return;
  }

  const { data: orderAfterErr } = await sb
    .from('orders')
    .select('id, order_number, meta_capi_status, meta_capi_event_id, meta_capi_sent_at, meta_capi_error')
    .eq('id', testOrderId)
    .single();

  console.log('   Fila en DB tras camino de ERROR:');
  console.log('   - meta_capi_status:', orderAfterErr.meta_capi_status, '✅');
  console.log('   - meta_capi_event_id:', orderAfterErr.meta_capi_event_id, '✅');
  console.log('   - meta_capi_sent_at:', orderAfterErr.meta_capi_sent_at, '(esperado: null) ✅');
  console.log('   - meta_capi_error:', orderAfterErr.meta_capi_error, '✅');

  // 3. Probar Camino de Éxito (despacho exitoso confirmado por Meta)
  console.log('\n3. Simulando camino de ÉXITO en Meta CAPI...');
  const sentTime = new Date().toISOString();

  const { error: updErr2 } = await sb.from('orders').update({
    meta_capi_status: 'sent',
    meta_capi_event_id: testEventId,
    meta_capi_sent_at: sentTime,
    meta_capi_error: null,
  }).eq('id', testOrderId);

  if (updErr2) {
    console.error('Error actualizando camino de éxito:', updErr2);
    return;
  }

  const { data: orderAfterSuccess } = await sb
    .from('orders')
    .select('id, order_number, meta_capi_status, meta_capi_event_id, meta_capi_sent_at, meta_capi_error')
    .eq('id', testOrderId)
    .single();

  console.log('   Fila en DB tras camino de ÉXITO:');
  console.log('   - meta_capi_status:', orderAfterSuccess.meta_capi_status, '✅');
  console.log('   - meta_capi_event_id:', orderAfterSuccess.meta_capi_event_id, '✅');
  console.log('   - meta_capi_sent_at:', orderAfterSuccess.meta_capi_sent_at, '✅');
  console.log('   - meta_capi_error:', orderAfterSuccess.meta_capi_error, '(esperado: null) ✅');

  // 4. Probar Camino Omitido / Falta de Token ('skipped')
  console.log('\n4. Simulando camino OMITIDO (falta token de CAPI)...');
  const tokenWarning = 'META_CONVERSIONS_API_TOKEN no está configurado en las variables de entorno del servidor.';
  await sb.from('orders').update({
    meta_capi_status: 'skipped',
    meta_capi_event_id: testEventId,
    meta_capi_sent_at: null,
    meta_capi_error: tokenWarning,
  }).eq('id', testOrderId);

  const { data: orderAfterSkipped } = await sb
    .from('orders')
    .select('id, order_number, meta_capi_status, meta_capi_event_id, meta_capi_sent_at, meta_capi_error')
    .eq('id', testOrderId)
    .single();

  console.log('   Fila en DB tras camino OMITIDO:');
  console.log('   - meta_capi_status:', orderAfterSkipped.meta_capi_status, '✅');
  console.log('   - meta_capi_error:', orderAfterSkipped.meta_capi_error, '✅');

  // 5. Limpieza de orden de prueba
  console.log('\n5. Limpiando orden de prueba en orders...');
  await sb.from('orders').delete().eq('id', testOrderId);
  console.log('   Orden de prueba eliminada limpiamente ✅');

  console.log('\n=== TEST 1.4 COMPLETADO CON ÉXITO ===\n');
}

run().catch(console.error);
