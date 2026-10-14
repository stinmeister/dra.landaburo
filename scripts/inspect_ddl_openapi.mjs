import https from 'https';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getOpenApi() {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: '/rest/v1/?apikey=' + SERVICE_KEY,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const spec = await getOpenApi();
  if (!spec.definitions) {
    console.log('No definitions in spec:', Object.keys(spec));
    return;
  }

  console.log('=============================================================================');
  console.log('ESQUEMA OFICIAL POSTGREST / OPENAPI (SUPABASE mdletvbgwzbpenzevurr)');
  console.log('Fecha:', new Date().toISOString());
  console.log('=============================================================================\n');

  // 1. orders
  console.log('--- 1. TABLA orders (columnas CAPI) ---');
  const ordersProps = spec.definitions.orders?.properties || {};
  const capiCols = Object.keys(ordersProps).filter(k => k.startsWith('meta_capi_'));
  for (const c of capiCols) {
    console.log(`  - ${c}:`, JSON.stringify(ordersProps[c]));
  }

  // 2. store_config
  console.log('\n--- 2. TABLA store_config (horarios y sobreventa) ---');
  const storeProps = spec.definitions.store_config?.properties || {};
  for (const c of ['attention_hours', 'allow_oversell_online', 'pickup_hours', 'checkout_enabled', 'shipping_enabled']) {
    console.log(`  - ${c}:`, JSON.stringify(storeProps[c]));
  }

  // 3. mp_webhook_events
  console.log('\n--- 3. TABLA mp_webhook_events ---');
  if (spec.definitions.mp_webhook_events) {
    console.log('  Definición encontrada:');
    const mpProps = spec.definitions.mp_webhook_events.properties || {};
    for (const [k, v] of Object.entries(mpProps)) {
      console.log(`    - ${k}:`, JSON.stringify(v));
    }
  } else {
    console.log('  ❌ NO EXISTE mp_webhook_events en definitions');
  }

  // 4. rate_limits
  console.log('\n--- 4. TABLA rate_limits ---');
  if (spec.definitions.rate_limits) {
    console.log('  Definición encontrada:');
    const rlProps = spec.definitions.rate_limits.properties || {};
    for (const [k, v] of Object.entries(rlProps)) {
      console.log(`    - ${k}:`, JSON.stringify(v));
    }
  } else {
    console.log('  ❌ NO EXISTE rate_limits en definitions');
  }

  // 5. deletion_audit
  console.log('\n--- 5. TABLA deletion_audit ---');
  if (spec.definitions.deletion_audit) {
    console.log('  Definición encontrada:');
    const daProps = spec.definitions.deletion_audit.properties || {};
    for (const [k, v] of Object.entries(daProps)) {
      console.log(`    - ${k}:`, JSON.stringify(v));
    }
  }

  // 6. RPCs en paths
  console.log('\n--- 6. RPC /rpc/obtener_metricas_ejecutivas ---');
  if (spec.paths['/rpc/obtener_metricas_ejecutivas']) {
    console.log('  RPC encontrada en PostgREST paths:');
    console.log(JSON.stringify(spec.paths['/rpc/obtener_metricas_ejecutivas'], null, 2));
  } else {
    console.log('  ❌ NO EXISTE /rpc/obtener_metricas_ejecutivas en paths');
  }
}

main().catch(console.error);
