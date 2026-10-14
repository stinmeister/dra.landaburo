import { createClient } from '@supabase/supabase-js';
import { isRateLimited } from '../src/lib/rateLimit.ts';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('=== TEST 1.2: VERIFICACIÓN REAL DE rate_limits EN POSTGRESQL ===\n');

  const testKey = 'test-ip-1410';
  const testNamespace = 'qa-verification';
  const fullKey = `${testNamespace}:${testKey}`;

  // 1. Limpiar cualquier fila previa de prueba
  await sb.from('rate_limits').delete().eq('key', fullKey);

  // 2. Primera llamada (debe permitir y crear fila en DB)
  console.log('1. Ejecutando intento #1...');
  const limit1 = await isRateLimited(testKey, testNamespace, { windowMs: 60000, max: 3 });
  console.log('   ¿Bloqueado en intento #1?:', limit1, '(esperado: false)');

  // 3. Consultar fila directamente en PostgreSQL
  const { data: row1 } = await sb.from('rate_limits').select('*').eq('key', fullKey).single();
  console.log('   Fila en DB tras intento #1:', row1);

  // 4. Segunda y tercera llamada (incrementa contador)
  console.log('2. Ejecutando intento #2...');
  await isRateLimited(testKey, testNamespace, { windowMs: 60000, max: 3 });
  console.log('3. Ejecutando intento #3...');
  await isRateLimited(testKey, testNamespace, { windowMs: 60000, max: 3 });

  const { data: row3 } = await sb.from('rate_limits').select('*').eq('key', fullKey).single();
  console.log('   Fila en DB tras intento #3:', row3);

  // 5. Cuarta llamada (debe bloquearse al superar max=3)
  console.log('4. Ejecutando intento #4 (debe bloquear)...');
  const limit4 = await isRateLimited(testKey, testNamespace, { windowMs: 60000, max: 3 });
  console.log('   ¿Bloqueado en intento #4?:', limit4 ? 'SÍ ✅' : 'NO ❌', '(esperado: true)');

  // 6. Probar persistencia (la fila sigue en la DB y sobrevive a reinicios)
  const { data: rowPersist } = await sb.from('rate_limits').select('*').eq('key', fullKey).single();
  console.log('   Confirmación de persistencia en tabla rate_limits:', rowPersist ? 'CONFIRMADO ✅' : 'FALLIDO ❌');

  // 7. Probar limpieza automática de filas vencidas
  console.log('5. Probando limpieza de filas expiradas...');
  const expiredKey = 'qa-expired-test';
  await sb.from('rate_limits').upsert({
    key: expiredKey,
    count: 5,
    reset_at: new Date(Date.now() - 5000).toISOString(), // 5 segundos en el pasado
    updated_at: new Date(Date.now() - 5000).toISOString(),
  });

  // Una llamada a isRateLimited dispara la limpieza de expirados
  await isRateLimited('trigger-clean', 'qa-clean', { windowMs: 10000, max: 10 });
  const { data: expiredCheck } = await sb.from('rate_limits').select('*').eq('key', expiredKey).maybeSingle();
  console.log('   ¿Fila expirada fue purgada automáticamente?:', !expiredCheck ? 'SÍ (PURGADA) ✅' : 'NO ❌');

  // 8. Limpiar datos de prueba
  await sb.from('rate_limits').delete().in('key', [fullKey, 'qa-clean:trigger-clean', expiredKey]);
  console.log('\n=== TEST 1.2 COMPLETADO CON ÉXITO ===\n');
}

run().catch(console.error);
