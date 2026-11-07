#!/usr/bin/env node
/**
 * Sincronizador diario de precios desde la planilla oficial de Google Drive
 * ("Precios Nati Gualeguaychu.") hacia Supabase (`products` y `treatments` de Cosmiatría).
 *
 * Modos de uso:
 *   node scripts/sync-prices-from-sheet.mjs --dry-run
 *   node scripts/sync-prices-from-sheet.mjs --dry-run --fixture scripts/fixtures/precios_nati_gualeguaychu_fixture.json
 *   node scripts/sync-prices-from-sheet.mjs --apply --send-email
 *
 * Variables de entorno leídas (NUNCA se imprimen sus valores):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - GOOGLE_PRICES_SHEET_ID
 *   - GOOGLE_SERVICE_ACCOUNT_KEY_PATH  (ruta a JSON de Service Account con chmod 600)
 *     o GOOGLE_SERVICE_ACCOUNT_JSON_B64 (alternativa en base64)
 *   - PRICE_SYNC_AUDIT_LOG_PATH        (opcional, default: /opt/dra-landaburo-shared/logs/price-sync-audit.jsonl)
 *   - RESEND_API_KEY                   (opcional, para envío de resumen cuando hay cambios o salteados)
 *   - PRICE_SYNC_NOTIFY_EMAIL          (opcional, destinatario del reporte)
 *   - RESEND_FROM_EMAIL                (opcional, remitente verificado en Resend)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SUPPORTED_TABS, planPriceSync } from '../src/lib/priceSync/sheetParser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function loadEnvLocalIfNeeded() {
  const envPath = path.join(ROOT_DIR, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function parseCliArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    fixturePath: null,
    offline: false,
    sendEmail: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') {
      args.apply = true;
      args.dryRun = false;
    } else if (arg === '--dry-run') {
      args.apply = false;
      args.dryRun = true;
    } else if (arg === '--offline') {
      args.offline = true;
    } else if (arg === '--send-email') {
      args.sendEmail = true;
    } else if (arg === '--fixture' && argv[i + 1]) {
      args.fixturePath = argv[++i];
    }
  }
  return args;
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function loadServiceAccountCredentials() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim();
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64?.trim();

  let rawJson = '';
  if (keyPath) {
    if (!fs.existsSync(keyPath)) {
      throw new Error(
        `No existe el archivo indicado en GOOGLE_SERVICE_ACCOUNT_KEY_PATH (${keyPath}).`
      );
    }
    rawJson = fs.readFileSync(keyPath, 'utf8');
  } else if (keyB64) {
    rawJson = Buffer.from(keyB64, 'base64').toString('utf8');
  } else {
    throw new Error(
      'Falta configurar GOOGLE_SERVICE_ACCOUNT_KEY_PATH o GOOGLE_SERVICE_ACCOUNT_JSON_B64.'
    );
  }

  const parsed = JSON.parse(rawJson);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      'La credencial de Service Account no contiene client_email o private_key válidos.'
    );
  }
  return {
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
    tokenUri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
  };
}

async function getGoogleReadonlyAccessToken() {
  const sa = loadServiceAccountCredentials();
  const nowSec = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: sa.tokenUri,
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(sa.privateKey);
  const assertion = `${signingInput}.${base64UrlEncode(signature)}`;

  const res = await fetch(sa.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    throw new Error(`Fallo al obtener token OAuth2 de Google (HTTP ${res.status}).`);
  }

  const tokenData = await res.json();
  if (!tokenData.access_token) {
    throw new Error('Respuesta OAuth2 de Google sin access_token.');
  }
  return tokenData.access_token;
}

async function fetchSheetsWorkbookFromGoogle() {
  const sheetId = process.env.GOOGLE_PRICES_SHEET_ID?.trim();
  if (!sheetId) {
    throw new Error('Falta configurar GOOGLE_PRICES_SHEET_ID.');
  }

  const accessToken = await getGoogleReadonlyAccessToken();
  const tabs = Object.values(SUPPORTED_TABS);

  const params = new URLSearchParams();
  params.set('valueRenderOption', 'FORMATTED_VALUE');
  for (const tab of tabs) {
    params.append('ranges', `'${tab}'!A1:Z500`);
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    sheetId
  )}/values:batchGet?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(
      `No se pudo leer la planilla en Google Sheets API (HTTP ${res.status}). No se modificó ningún dato.`
    );
  }

  const data = await res.json();
  const valueRanges = Array.isArray(data.valueRanges) ? data.valueRanges : [];
  if (valueRanges.length !== tabs.length) {
    throw new Error(
      `Se esperaban ${tabs.length} pestañas y Google Sheets devolvió ${valueRanges.length}. Abortando por seguridad.`
    );
  }

  /** @type {Record<string, unknown[][]>} */
  const sheetsByTab = {};
  tabs.forEach((tabName, idx) => {
    sheetsByTab[tabName] = valueRanges[idx]?.values || [];
  });

  return sheetsByTab;
}

function resolveAuditLogPath() {
  if (process.env.PRICE_SYNC_AUDIT_LOG_PATH?.trim()) {
    return process.env.PRICE_SYNC_AUDIT_LOG_PATH.trim();
  }
  if (process.platform !== 'win32' && fs.existsSync('/opt')) {
    return '/opt/dra-landaburo-shared/logs/price-sync-audit.jsonl';
  }
  return path.join(ROOT_DIR, 'logs', 'price-sync-audit.jsonl');
}

function appendAuditJsonl(logPath, entries) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(logPath, lines, 'utf8');
}

function formatArs(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return 'sin precio';
  return `$${Math.round(Number(n)).toLocaleString('es-AR')}`;
}

function buildPlainTextReport({ runId, timestampAr, modeLabel, sourceLabel, plan, appliedCount }) {
  const lines = [];
  lines.push('====================================================================');
  lines.push(' REPORTE DE SINCRONIZACIÓN DE PRECIOS — DRA. PAULA LANDABURO');
  lines.push('====================================================================');
  lines.push(`Corrida ID   : ${runId}`);
  lines.push(`Fecha (AR)   : ${timestampAr}`);
  lines.push(`Modo         : ${modeLabel}`);
  lines.push(`Fuente       : ${sourceLabel}`);
  lines.push('--------------------------------------------------------------------');
  lines.push('RESUMEN DE LECTURA POR PESTAÑA:');
  for (const t of plan.tabStats) {
    lines.push(
      `  - ${t.tab.padEnd(20)} | filas leídas: ${String(t.totalRowsRead).padStart(3)} | con codigo_web: ${String(
        t.rowsWithCode
      ).padStart(3)}`
    );
  }
  lines.push('--------------------------------------------------------------------');
  lines.push(`Total filas de datos leídas     : ${plan.totalRowsRead}`);
  lines.push(`Total ítems con codigo_web      : ${plan.totalCodedRows}`);
  lines.push(
    `Ítems ${appliedCount !== null ? 'actualizados en DB' : 'que cambiarían (dry-run)'} : ${
      appliedCount !== null ? appliedCount : plan.updates.length
    }`
  );
  lines.push(`Ítems sin cambios (mismo valor) : ${plan.unchanged.length}`);
  lines.push(`Filas salteadas / retenidas     : ${plan.skipped.length}`);
  lines.push('--------------------------------------------------------------------');

  lines.push('\n1) CAMBIOS DE PRECIO:');
  if (plan.updates.length === 0) {
    lines.push('   (Ningún cambio de precio para aplicar)');
  } else {
    for (const u of plan.updates) {
      const sign = u.pctChange > 0 ? '+' : '';
      lines.push(
        `   - [${u.entityType}] ${u.codigoWeb} ("${u.entityName}") | ${u.tab} fila ${u.rowNumber}: ${formatArs(
          u.oldPriceArs
        )} -> ${formatArs(u.newPriceArs)} (${sign}${u.pctChange}%)`
      );
    }
  }

  lines.push('\n2) FILAS SALTEADAS / RETENIDAS PARA REVISIÓN:');
  if (plan.skipped.length === 0) {
    lines.push('   (Ninguna fila salteada)');
  } else {
    for (const s of plan.skipped) {
      lines.push(
        `   - [${s.reason}] ${s.tab} fila ${s.rowNumber} | codigo_web="${s.codigoWeb}" | celda="${String(
          s.rawPrice ?? ''
        )}" -> ${s.detail}`
      );
    }
  }

  lines.push('====================================================================');
  return lines.join('\n');
}

async function maybeSendSummaryEmail({ subject, reportText }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const notifyTo =
    process.env.PRICE_SYNC_NOTIFY_EMAIL?.trim() ||
    process.env.CONTACT_NOTIFICATION_EMAILS?.split(',')[0]?.trim();
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || 'Consultorio Dra. Landaburo <notificaciones@dralandaburo.com>';

  if (!apiKey || !notifyTo) {
    console.log(
      '[email] Envío omitido: falta configurar RESEND_API_KEY o PRICE_SYNC_NOTIFY_EMAIL.'
    );
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [notifyTo],
      subject,
      text: reportText,
    }),
  });

  if (!res.ok) {
    console.error(`[email] Resend devolvió HTTP ${res.status} al enviar el resumen.`);
  } else {
    console.log('[email] Resumen de sincronización enviado por correo.');
  }
}

async function main() {
  loadEnvLocalIfNeeded();
  const args = parseCliArgs(process.argv.slice(2));
  const runId = crypto.randomUUID();
  const timestampAr = new Date().toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour12: false,
  });

  let sheetsByTab;
  let fixtureData = null;
  let sourceLabel = 'Google Sheets API (Service Account readonly)';

  if (args.fixturePath) {
    const resolvedFixture = path.resolve(process.cwd(), args.fixturePath);
    fixtureData = JSON.parse(fs.readFileSync(resolvedFixture, 'utf8'));
    sheetsByTab = fixtureData.sheetsByTab;
    sourceLabel = `Fixture local (${path.basename(resolvedFixture)})`;
  } else {
    sheetsByTab = await fetchSheetsWorkbookFromGoogle();
  }

  let supabase = null;
  let products = [];
  let treatments = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!args.offline && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const [prodRes, treatRes] = await Promise.all([
      supabase.from('products').select('id, slug, name, price_ars, is_active'),
      supabase.from('treatments').select('id, slug, title, category, price_ars, is_active'),
    ]);

    if (prodRes.error) {
      throw new Error(`Error leyendo products en Supabase: ${prodRes.error.message}`);
    }
    if (treatRes.error) {
      throw new Error(`Error leyendo treatments en Supabase: ${treatRes.error.message}`);
    }

    products = prodRes.data || [];
    treatments = treatRes.data || [];
  } else if (fixtureData?.catalogSnapshot) {
    products = fixtureData.catalogSnapshot.products || [];
    treatments = fixtureData.catalogSnapshot.treatments || [];
    sourceLabel += ' + catálogo snapshot offline';
  } else {
    throw new Error(
      'Faltan variables NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para leer el catálogo.'
    );
  }

  const plan = planPriceSync({
    sheetsByTab,
    products,
    treatments,
    maxPctChange: 50,
  });

  if (args.dryRun) {
    const reportText = buildPlainTextReport({
      runId,
      timestampAr,
      modeLabel: 'DRY-RUN (simulación — 0 escrituras en base de datos)',
      sourceLabel,
      plan,
      appliedCount: null,
    });
    console.log(reportText);
    return;
  }

  if (!supabase) {
    throw new Error('No se puede ejecutar --apply en modo offline sin conexión a Supabase.');
  }

  let appliedCount = 0;
  const auditEntries = [];
  const isoNow = new Date().toISOString();

  for (const u of plan.updates) {
    const table = u.entityType === 'product' ? 'products' : 'treatments';
    const { error } = await supabase
      .from(table)
      .update({ price_ars: u.newPriceArs, updated_at: isoNow })
      .eq('id', u.entityId);

    if (error) {
      throw new Error(
        `Error actualizando ${table} (${u.codigoWeb}): ${error.message}`
      );
    }

    appliedCount++;
    auditEntries.push({
      run_id: runId,
      synced_at: isoNow,
      entity_type: u.entityType,
      entity_id: u.entityId,
      codigo_web: u.codigoWeb,
      entity_name: u.entityName,
      tab_name: u.tab,
      row_number: u.rowNumber,
      raw_cell: u.rawPrice,
      old_price_ars: u.oldPriceArs,
      new_price_ars: u.newPriceArs,
      pct_change: u.pctChange,
    });
  }

  // Registro persistente en JSONL (siempre disponible sin depender de DDL)
  const auditLogPath = resolveAuditLogPath();
  if (auditEntries.length > 0) {
    appendAuditJsonl(auditLogPath, auditEntries);
    console.log(`[audit] ${auditEntries.length} cambio(s) registrados en ${auditLogPath}`);

    // Si la tabla SQL public.price_sync_audit ya fue creada por Agustín, guardar también ahí
    const { error: dbAuditErr } = await supabase.from('price_sync_audit').insert(auditEntries);
    if (dbAuditErr && dbAuditErr.code !== 'PGRST205') {
      console.warn(`[audit] Aviso al insertar en price_sync_audit: ${dbAuditErr.message}`);
    }
  }

  const reportText = buildPlainTextReport({
    runId,
    timestampAr,
    modeLabel: 'APPLY (escritura real en Supabase)',
    sourceLabel,
    plan,
    appliedCount,
  });
  console.log(reportText);

  if (args.sendEmail && (appliedCount > 0 || plan.skipped.length > 0)) {
    await maybeSendSummaryEmail({
      subject: `[Dra. Landaburo] Sincronización de precios: ${appliedCount} cambio(s), ${plan.skipped.length} salteado(s)`,
      reportText,
    });
  }
}

main().catch((err) => {
  console.error(`[sync-prices-from-sheet] ERROR ABORTADO (0 cambios inesperados): ${err.message}`);
  process.exit(1);
});
