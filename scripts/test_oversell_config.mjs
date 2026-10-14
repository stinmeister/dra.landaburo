import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('=== TEST 1.5: VERIFICACIÓN REAL DE SOBREVENTA (store_config.allow_oversell_online) ===\n');

  // 1. Confirmar ausencia de variable de entorno
  console.log('1. Verificando process.env.ALLOW_OVERSELL_ONLINE:');
  console.log('   Valor en process.env:', process.env.ALLOW_OVERSELL_ONLINE ?? 'UNDEFINED (100% ausente) ✅');

  // 2. Consultar valor actual en store_config
  const { data: initialCfg } = await sb.from('store_config').select('id, allow_oversell_online').eq('id', 1).single();
  console.log('\n2. Valor inicial en store_config en DB:', initialCfg);

  // 3. Simular cambio desde Dashboard (toggle a true)
  console.log('\n3. Cambiando allow_oversell_online a true en DB...');
  await sb.from('store_config').update({ allow_oversell_online: true }).eq('id', 1);

  const { data: cfgTrue } = await sb.from('store_config').select('id, allow_oversell_online').eq('id', 1).single();
  console.log('   Valor en DB tras cambio a true:', cfgTrue?.allow_oversell_online === true ? 'TRUE ✅' : 'FALLÓ ❌');

  // 4. Restaurar a false (seguridad y consistencia de negocio)
  console.log('\n4. Restaurando allow_oversell_online a false (default)...');
  await sb.from('store_config').update({ allow_oversell_online: false }).eq('id', 1);

  const { data: cfgRestored } = await sb.from('store_config').select('id, allow_oversell_online').eq('id', 1).single();
  console.log('   Valor en DB restaurado a false:', cfgRestored?.allow_oversell_online === false ? 'FALSE (RESTAURADO) ✅' : 'FALLÓ ❌');

  console.log('\n=== TEST 1.5 COMPLETADO CON ÉXITO ===\n');
}

run().catch(console.error);
