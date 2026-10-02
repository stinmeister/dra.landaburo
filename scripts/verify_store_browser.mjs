import fs from 'fs';
import path from 'path';
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
  console.log('--- INICIANDO VERIFICACIÓN DE TIENDA Y CARRITO EN NAVEGADOR ---');

  // 1. Verificar estado actual en DB
  const { data: initialConfig, error: configErr } = await supabase
    .from('store_config')
    .select('*')
    .eq('id', 1)
    .single();

  if (configErr || !initialConfig) {
    console.error('Error leyendo store_config:', configErr);
    process.exit(1);
  }

  console.log('Estado inicial store_config:', {
    checkout_enabled: initialConfig.checkout_enabled,
    shipping_enabled: initialConfig.shipping_enabled,
    pickup_address: initialConfig.pickup_address,
    pickup_hours: initialConfig.pickup_hours
  });

  // Asegurar que checkout_enabled está false
  if (initialConfig.checkout_enabled !== false) {
    console.log('Asegurando checkout_enabled = false...');
    await supabase.from('store_config').update({ checkout_enabled: false }).eq('id', 1);
  }

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  try {
    // 2. Navegar a /tienda
    console.log('\n[TEST 1] Navegando a https://www.dralandaburo.com/tienda');
    await page.goto('https://www.dralandaburo.com/tienda', { waitUntil: 'networkidle' });

    // Inyectar producto de prueba en el carrito si hace falta o hacer clic
    // Verificamos si hay un producto con stock
    console.log('Poniendo item en localStorage cart...');
    const testCartItem = {
      id: 'f87a8b6e-2144-48e7-817a-0d7ea7106093',
      slug: 'serum-antiox-c',
      name: 'Serum Antiox C Test',
      price_ars: 45000,
      image_url: null,
      quantity: 1
    };

    await page.evaluate((item) => {
      localStorage.setItem('landaburo_cart_v1', JSON.stringify([item]));
    }, testCartItem);

    // 3. Navegar a /tienda/carrito
    console.log('\n[TEST 2] Navegando a https://www.dralandaburo.com/tienda/carrito');
    await page.goto('https://www.dralandaburo.com/tienda/carrito', { waitUntil: 'networkidle' });

    // Esperar a que cargue el estado de la tienda
    await page.waitForTimeout(2000);

    // Verificar elementos:
    const pickupOptionVisible = await page.isVisible('text=Retiro en consultorio');
    const shippingOptionVisible = await page.isVisible('text=Envío a domicilio');
    const pickupAddressText = await page.textContent('body');
    const hasAlem = pickupAddressText.includes('Leandro N. Alem 45');
    const hasHours = pickupAddressText.includes('Lunes a Viernes de 9:00 a 17:00 hs');

    // Botón de pago desactivado
    const disabledBtn = await page.locator('button:has-text("Los pagos online están temporalmente desactivados")');
    const isDisabled = await disabledBtn.isDisabled();

    // Enlace a WhatsApp
    const waLink = await page.locator('a[href*="wa.me"]');
    const waHref = await waLink.first().getAttribute('href');

    console.log('Resultados Test 1 (Checkout Desactivado):', {
      pickupOptionVisible,
      shippingOptionVisible, // debe ser false
      hasAlem,
      hasHours,
      buttonIsDisabled: isDisabled,
      hasWhatsAppLink: Boolean(waHref)
    });

    const shot1Path = path.join(ARTIFACT_DIR, 'screenshot_carrito_desactivado.png');
    await page.screenshot({ path: shot1Path, fullPage: true });
    console.log('Captura guardada en:', shot1Path);

    // 4. Test de Envíos Habilitados
    console.log('\n[TEST 3] Habilitando temporalmente shipping_enabled = true en store_config...');
    await supabase.from('store_config').update({ shipping_enabled: true }).eq('id', 1);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const shippingOptionVisibleAfter = await page.isVisible('text=Envío a domicilio');
    console.log('¿Aparece opción Envío a domicilio?:', shippingOptionVisibleAfter);

    if (shippingOptionVisibleAfter) {
      console.log('Seleccionando "Envío a domicilio"...');
      await page.click('text=Envío a domicilio');
      await page.waitForTimeout(500);

      const addressInput = await page.isVisible('input#address');
      const cityInput = await page.isVisible('input#city');
      const postalInput = await page.isVisible('input#postalCode');

      console.log('Campos de dirección visibles:', { addressInput, cityInput, postalInput });

      const shot2Path = path.join(ARTIFACT_DIR, 'screenshot_carrito_envio_activo.png');
      await page.screenshot({ path: shot2Path, fullPage: true });
      console.log('Captura con envío guardada en:', shot2Path);
    }

    // 5. Restaurar estado inicial de shipping_enabled
    console.log('\n[TEST 4] Restaurando shipping_enabled = false en store_config...');
    await supabase.from('store_config').update({ shipping_enabled: false }).eq('id', 1);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const shippingGone = !(await page.isVisible('text=Envío a domicilio'));
    console.log('¿Opción envío desapareció correctamente?:', shippingGone);

    const shot3Path = path.join(ARTIFACT_DIR, 'screenshot_carrito_restaurado.png');
    await page.screenshot({ path: shot3Path, fullPage: true });
    console.log('Captura restaurada guardada en:', shot3Path);

  } finally {
    // Asegurar que siempre queda checkout_enabled = false y shipping_enabled = false
    await supabase.from('store_config').update({
      checkout_enabled: false,
      shipping_enabled: false
    }).eq('id', 1);
    console.log('\nBase de datos verificada y asegurada: checkout_enabled = false, shipping_enabled = false.');
    await browser.close();
  }
}

run().catch(err => {
  console.error('Error durante la verificación:', err);
  process.exit(1);
});
