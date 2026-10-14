import https from 'https';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

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

async function run() {
  console.log('=== INICIANDO RELEVAMIENTO COMPLETO DE BASE DE DATOS ===\n');

  const spec = await getOpenApi();
  if (!spec.definitions) {
    console.error('No se pudo obtener la especificación OpenAPI de PostgREST');
    return;
  }

  const tableNames = Object.keys(spec.definitions).sort();
  console.log(`Tablas detectadas en PostgREST definitions (${tableNames.length}):`);
  console.log(tableNames.join(', '));

  const tableDetails = {};
  const rowCounts = {};

  for (const table of tableNames) {
    const def = spec.definitions[table];
    const properties = def.properties || {};
    const required = def.required || [];

    // Contar filas reales en la tabla
    let count = 0;
    try {
      const { count: c, error: cntErr } = await sbAdmin.from(table).select('*', { count: 'exact', head: true });
      if (!cntErr) {
        count = c ?? 0;
      } else {
        count = `Error: ${cntErr.message}`;
      }
    } catch (e) {
      count = `Excepción: ${e.message}`;
    }
    rowCounts[table] = count;

    const cols = [];
    for (const [colName, colMeta] of Object.entries(properties)) {
      cols.push({
        name: colName,
        type: colMeta.type || 'unknown',
        format: colMeta.format || colMeta.type || '',
        description: colMeta.description || '',
        default: colMeta.default !== undefined ? colMeta.default : null,
        required: required.includes(colName),
      });
    }

    tableDetails[table] = {
      description: def.description || '',
      columnCount: cols.length,
      rowCount: count,
      columns: cols,
    };
  }

  // RPCs
  const rpcs = [];
  for (const [path, pathMeta] of Object.entries(spec.paths || {})) {
    if (path.startsWith('/rpc/')) {
      const rpcName = path.replace('/rpc/', '');
      const postMeta = pathMeta.post || {};
      rpcs.push({
        name: rpcName,
        description: postMeta.description || '',
        parameters: postMeta.parameters || [],
      });
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    totalTables: tableNames.length,
    rowCounts,
    tableDetails,
    rpcs,
  };

  fs.writeFileSync('scripts/relevamiento_bd_output.json', JSON.stringify(result, null, 2));
  console.log(`\nRelevamiento guardado en scripts/relevamiento_bd_output.json con ${tableNames.length} tablas y ${rpcs.length} RPCs.`);
}

run().catch(console.error);
