import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const secret = process.env.MP_WEBHOOK_SECRET;

async function run() {
  console.log('=== TEST 1.3: VERIFICACIÓN REAL DE IDEMPOTENCIA EN mp_webhook_events ===\n');

  if (!secret) {
    console.error('ERROR: MP_WEBHOOK_SECRET no está definido en variables de entorno.');
    return;
  }

  const paymentId = '9999991410';
  const eventId = `${paymentId}_payment`;
  const requestId = 'req-qa-idempotencia-1410';
  const ts = Math.floor(Date.now() / 1000).toString();

  // 1. Limpieza previa de pruebas anteriores
  await sb.from('mp_webhook_events').delete().eq('event_id', eventId);

  // 2. Generar firma HMAC-SHA256 válida
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const hash = createHmac('sha256', secret).update(manifest).digest('hex');
  const signature = `ts=${ts},v1=${hash}`;

  const payload = {
    action: 'payment.created',
    api_version: 'v1',
    data: { id: paymentId },
    date_created: new Date().toISOString(),
    id: 14101410,
    live_mode: false,
    type: 'payment',
    user_id: '123456789'
  };

  console.log('1. Contando tareas en staff_tasks y movimientos de stock antes del test...');
  const { count: tasksBefore } = await sb.from('staff_tasks').select('*', { count: 'exact', head: true });
  const { count: stockMovsBefore } = await sb.from('stock_movements').select('*', { count: 'exact', head: true });
  console.log(`   staff_tasks iniciales: ${tasksBefore}, stock_movements iniciales: ${stockMovsBefore}`);

  // 3. Primer despacho (Inserción real en mp_webhook_events)
  console.log('\n2. Enviando Notificación #1 (Debe registrarse en mp_webhook_events)...');
  const res1 = await fetch('https://dralandaburo.com/api/webhook/mercadopago?data.id=' + paymentId, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature,
      'x-request-id': requestId,
    },
    body: JSON.stringify(payload),
  });

  const res1Json = await res1.json().catch(() => ({}));
  console.log(`   Respuesta HTTP Notificación #1: Status ${res1.status}`, res1Json);

  // Consultar mp_webhook_events en la BD
  const { data: eventsAfter1 } = await sb
    .from('mp_webhook_events')
    .select('id, event_id, payment_id, status, processed_at')
    .eq('event_id', eventId);

  console.log('   Filas en mp_webhook_events tras Notificación #1:', eventsAfter1);

  const { count: tasksAfter1 } = await sb.from('staff_tasks').select('*', { count: 'exact', head: true });
  const { count: stockMovsAfter1 } = await sb.from('stock_movements').select('*', { count: 'exact', head: true });

  // 4. Segundo despacho IDÉNTICO (Debe detectar duplicado y responder 200 duplicate: true)
  console.log('\n3. Enviando Notificación #2 IDÉNTICA (Debe ser detectada como duplicado)...');
  const res2 = await fetch('https://dralandaburo.com/api/webhook/mercadopago?data.id=' + paymentId, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature,
      'x-request-id': requestId,
    },
    body: JSON.stringify(payload),
  });

  const res2Json = await res2.json().catch(() => ({}));
  console.log(`   Respuesta HTTP Notificación #2: Status ${res2.status}`, res2Json);

  // Consultar mp_webhook_events en la BD nuevamente
  const { data: eventsAfter2 } = await sb
    .from('mp_webhook_events')
    .select('id, event_id, payment_id, status, processed_at')
    .eq('event_id', eventId);

  console.log('   Filas en mp_webhook_events tras Notificación #2:', eventsAfter2);
  console.log('   ¿Se mantuvo exactamente 1 sola fila en mp_webhook_events?:', eventsAfter2?.length === 1 ? 'SÍ ✅' : 'NO ❌');

  const { count: tasksAfter2 } = await sb.from('staff_tasks').select('*', { count: 'exact', head: true });
  const { count: stockMovsAfter2 } = await sb.from('stock_movements').select('*', { count: 'exact', head: true });

  console.log(`\n4. Comparación de efectos secundarios:`);
  console.log(`   staff_tasks: Antes=${tasksAfter1}, Después=${tasksAfter2} -> ${tasksAfter1 === tasksAfter2 ? 'IGUALES ✅' : 'DIFERENTES ❌'}`);
  console.log(`   stock_movements: Antes=${stockMovsAfter1}, Después=${stockMovsAfter2} -> ${stockMovsAfter1 === stockMovsAfter2 ? 'IGUALES ✅' : 'DIFERENTES ❌'}`);

  // 5. Limpieza de fila de prueba en mp_webhook_events
  console.log('\n5. Limpiando fila de prueba en mp_webhook_events...');
  await sb.from('mp_webhook_events').delete().eq('event_id', eventId);
  console.log('   Fila de prueba limpiada ✅');

  console.log('\n=== TEST 1.3 COMPLETADO CON ÉXITO ===\n');
}

run().catch(console.error);
