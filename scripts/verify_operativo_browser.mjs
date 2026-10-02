import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Cargar .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      let v = trimmed.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  });
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Faltan SUPABASE_URL o SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/682fda51-e41e-415e-81aa-fa10256a49ba';

async function run() {
  console.log('--- INICIANDO VERIFICACIÓN DE DASHBOARD OPERATIVO EN NAVEGADOR ---');

  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const qaEmail = `qa-admin-${randomSuffix}@dralandaburo.internal`;
  const qaPassword = `P@ss-${crypto.randomUUID()}`;
  let qaUserId = null;

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  try {
    // 1. Crear usuario QA con rol admin
    console.log(`Creando usuario QA efímero: ${qaEmail}...`);
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: qaEmail,
      password: qaPassword,
      email_confirm: true,
      user_metadata: { full_name: 'QA Admin Verification' }
    });

    if (authErr || !authUser?.user) {
      throw new Error(`Error creando usuario QA: ${authErr?.message}`);
    }

    qaUserId = authUser.user.id;

    // Actualizar perfil a admin
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ role: 'admin', full_name: 'QA Admin Verification' })
      .eq('id', qaUserId);

    if (profErr) {
      throw new Error(`Error asignando rol admin a perfil: ${profErr.message}`);
    }

    console.log('Usuario QA creado y asignado como admin correctamente.');

    // 2. Navegar a /login
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 }
    });
    const page = await context.newPage();

    console.log('Navegando a https://www.dralandaburo.com/login...');
    await page.goto('https://www.dralandaburo.com/login', { waitUntil: 'networkidle' });

    // Completar formulario de login
    await page.fill('input[type="email"]', qaEmail);
    await page.fill('input[type="password"]', qaPassword);
    await page.click('button[type="submit"]');

    // Esperar redirección post-login
    console.log('Esperando navegación post-login...');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});

    // Navegar directamente a /dashboard/operativo
    console.log('Navegando a https://www.dralandaburo.com/dashboard/operativo...');
    await page.goto('https://www.dralandaburo.com/dashboard/operativo', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    const hasOrdersInbox = bodyText.includes('Bandeja de pedidos web');
    const hasMyTasks = bodyText.includes('Mis tareas') || bodyText.includes('Tareas asignadas');
    const hasTeamTasks = bodyText.includes('Del equipo') || bodyText.includes('Tareas del equipo');
    const hasStoreSwitch = bodyText.includes('Configuración de Tienda') || bodyText.includes('Mercado Pago');

    console.log('Verificaciones en /dashboard/operativo:', {
      hasOrdersInbox,
      hasMyTasks,
      hasTeamTasks,
      hasStoreSwitch
    });

    const shotPath = path.join(ARTIFACT_DIR, 'screenshot_dashboard_operativo.png');
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log('Captura guardada en:', shotPath);

  } finally {
    if (qaUserId) {
      console.log(`Destruyendo usuario QA efímero ${qaUserId}...`);
      await supabase.auth.admin.deleteUser(qaUserId);
      await supabase.from('profiles').delete().eq('id', qaUserId);
      console.log('Usuario QA eliminado completamente.');
    }
    await browser.close();
  }
}

run().catch(err => {
  console.error('Error durante la verificación:', err);
  process.exit(1);
});
