import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORIGINAL_HOURS = 'Lun-Vier: 10:00 – 19:00 hs, Sáb: Solo con cita previa';
const SENTINEL_HOURS = 'Lun-Vier: 08:15 – 17:45 hs, Sáb: Cerrado [TEST_CENTINELA_1410]';

async function run() {
  console.log('=== TEST 1.1: VERIFICACIÓN REAL DE FOOTER CONTRA store_config ===\n');

  // 1. Guardar valor actual
  const { data: initialData } = await sb.from('store_config').select('attention_hours').eq('id', 1).single();
  console.log('1. Valor inicial en base de datos:', initialData?.attention_hours);

  // 2. Actualizar a valor centinela en la base de datos
  console.log('2. Actualizando store_config.attention_hours a valor centinela...');
  const { error: updErr } = await sb
    .from('store_config')
    .update({ attention_hours: SENTINEL_HOURS })
    .eq('id', 1);

  if (updErr) {
    console.error('Error actualizando store_config:', updErr);
    return;
  }
  console.log('   Valor centinela establecido en DB ✅');

  // 3. Consultar la web pública en https://dralandaburo.com
  console.log('3. Consultando HTML de https://dralandaburo.com ...');
  const res = await fetch('https://dralandaburo.com/', { cache: 'no-store' });
  const html = await res.text();

  const foundSentinel = html.includes('TEST_CENTINELA_1410') || html.includes('08:15 – 17:45');
  const foundDefault = html.includes('10:00 – 19:00');

  console.log('   ¿Contiene valor centinela en HTML?:', foundSentinel ? 'SÍ ✅' : 'NO ❌');
  console.log('   ¿Contiene valor previo en HTML?:', foundDefault ? 'SÍ (en caché/estático)' : 'NO');

  // 4. Restaurar valor original
  console.log('4. Restaurando valor original en la base de datos...');
  await sb
    .from('store_config')
    .update({ attention_hours: ORIGINAL_HOURS })
    .eq('id', 1);
  console.log('   Valor original restaurado en DB ✅\n');
}

run().catch(console.error);
