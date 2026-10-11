/**
 * scripts/verify-produccion.mjs
 * Script de verificación automatizada contra la URL pública de producción: https://dralandaburo.com
 *
 * Chequeos ejecutados (Ronda del 12/10):
 * 1. Checkout online desactivado (status API: checkoutEnabled === false)
 * 2. Guard del servidor de checkout activo (POST /api/checkout/mercadopago devuelve 403 prohibido)
 * 3. /consentimientos: sin matrícula 11.439 y con meta robots noindex
 * 4. Barrido de credenciales: cero matrículas médicas no confirmadas en rutas públicas clave
 * 5. Títulos canónicos: ausencia de nombres duplicados ("| Dra. Landaburo | Dra. Landaburo")
 * 6. Footer: única sede Leandro N. Alem 45, Gualeguaychú (sin sedes ajenas)
 * 7. Footer: especialidad canónica restaurada ("Dermatóloga")
 * 8. Footer: horarios de atención en consultorio (10:00 – 19:00 hs desde store_config)
 * 9. Ficha de producto: título canónico e hidratado (sin duplicaciones)
 * 10. Botón flotante de WhatsApp activo y visible en el sitio
 */

import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.VERIFY_BASE_URL || 'https://dralandaburo.com';

async function fetchText(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'AntigravityProductionVerifier/2.0',
      'Accept': 'text/html,application/json',
    },
    cache: 'no-store',
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text, headers: res.headers };
}

async function fetchJson(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'AntigravityProductionVerifier/2.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, json };
}

async function runVerification() {
  console.log(`\n=============================================================================`);
  console.log(`🔍 VERIFICACIÓN DE PRODUCCIÓN (RONDA 12/10) — ${BASE_URL}`);
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`=============================================================================\n`);

  let allPassed = true;

  function report(name, passed, details) {
    if (passed) {
      console.log(`✅ [PASS] ${name}`);
    } else {
      console.log(`❌ [FAIL] ${name}`);
      allPassed = false;
    }
    if (details) {
      console.log(`   ℹ️  ${details}`);
    }
  }

  // ── 1. Checkout desactivado (API status) ────────────────────────────────────
  try {
    const statusRes = await fetchJson('/api/checkout/mercadopago/status');
    const isCheckoutDisabled = statusRes.ok && statusRes.json?.checkoutEnabled === false;
    report(
      'Checkout online desactivado estrictamente (checkout_enabled === false)',
      isCheckoutDisabled,
      `HTTP ${statusRes.status} — checkoutEnabled: ${statusRes.json?.checkoutEnabled}`
    );
  } catch (err) {
    report('Checkout online desactivado estrictamente', false, `Error: ${err.message}`);
  }

  // ── 2. Guard del servidor de checkout (POST protegido) ─────────────────────
  try {
    const postRes = await fetchJson('/api/checkout/mercadopago', {
      method: 'POST',
      body: {
        items: [{ id: 'dummy', slug: 'dummy', name: 'Test', price_ars: 100, quantity: 1, image_url: null }],
        buyer: { name: 'Verifier Test', email: 'verifier@test.local', phone: '123456' },
      },
    });
    const isForbidden = postRes.status === 403 && (postRes.json?.error || '').includes('desactivados');
    report(
      'Guard del servidor de checkout activo (POST bloqueado con 403)',
      isForbidden,
      `HTTP ${postRes.status} — ${postRes.json?.error || 'Sin mensaje'}`
    );
  } catch (err) {
    report('Guard del servidor de checkout activo', false, `Error: ${err.message}`);
  }

  // ── 3. /consentimientos: sin 11.439 y con noindex ───────────────────────────
  try {
    const consentRes = await fetchText('/consentimientos');
    const html = consentRes.text;
    const has11439 = html.includes('11.439') || html.includes('11439');
    const hasNoIndex = html.includes('noindex');
    const hasPresencial = html.includes('presencial') || html.includes('consultorio');

    report(
      '/consentimientos sin matrícula no confirmada (11.439 eliminada)',
      !has11439,
      has11439 ? 'Se encontró mención a 11.439 en /consentimientos' : 'Cero referencias a 11.439 en la página'
    );

    report(
      '/consentimientos configurado con robots noindex',
      hasNoIndex,
      hasNoIndex ? 'Directiva noindex confirmada en metadata' : 'Falta directiva noindex'
    );

    report(
      '/consentimientos aclara firma y explicación presencial',
      hasPresencial,
      'Se informa que el consentimiento es presencial en consultorio'
    );
  } catch (err) {
    report('/consentimientos: validaciones de contenido y metadata', false, `Error: ${err.message}`);
  }

  // ── 4. Barrido de credenciales: cero matrículas no confirmadas ─────────────
  try {
    const routesToCheck = ['/', '/sobre-mi', '/contacto', '/consentimientos'];
    let foundMatricula = false;
    let foundRoute = '';

    for (const route of routesToCheck) {
      const res = await fetchText(route);
      if (res.text.includes('11.439') || res.text.includes('11439')) {
        foundMatricula = true;
        foundRoute = route;
        break;
      }
    }

    report(
      'Barrido de rutas clave: Ninguna matrícula no confirmada publicada',
      !foundMatricula,
      foundMatricula ? `Se detectó matrícula en ${foundRoute}` : 'Rutas /, /sobre-mi, /contacto, /consentimientos limpias'
    );
  } catch (err) {
    report('Barrido de rutas clave', false, `Error: ${err.message}`);
  }

  // ── 5. Títulos sin el nombre duplicado ("| Dra. Landaburo | Dra. Landaburo") ─
  try {
    const testPages = ['/', '/sobre-mi', '/contacto', '/consentimientos', '/tratamientos'];
    let hasDuplicateTitle = false;
    let dupDetails = '';

    for (const path of testPages) {
      const pageRes = await fetchText(path);
      const titleMatch = pageRes.text.match(/<title>([^<]+)<\/title>/i);
      const titleText = titleMatch ? titleMatch[1].trim() : '';

      if (titleText.includes('Dra. Landaburo | Dra. Landaburo') || titleText.includes('Dra. Paula Landaburo | Dra. Paula Landaburo')) {
        hasDuplicateTitle = true;
        dupDetails = `${path} -> "${titleText}"`;
        break;
      }
    }

    report(
      'Títulos de páginas públicas sin nombres duplicados de plantilla',
      !hasDuplicateTitle,
      hasDuplicateTitle ? `Duplicación detectada en ${dupDetails}` : 'Plantilla de metadata limpia en todas las páginas probadas'
    );
  } catch (err) {
    report('Títulos de páginas públicas', false, `Error: ${err.message}`);
  }

  // ── 6. Footer: Sede única y sin sedes ajenas (Home) ──────────────────────────
  let homeHtml = '';
  try {
    const homeRes = await fetchText('/');
    homeHtml = homeRes.text;

    const hasGchu = homeHtml.includes('Leandro N. Alem 45') && homeHtml.includes('Gualeguaychú');
    const hasPalermo = homeHtml.includes('Palermo') || homeHtml.includes('Güemes 4832');
    report(
      'Footer: Sede exclusiva en Gualeguaychú (sin sedes ajenas)',
      hasGchu && !hasPalermo,
      hasPalermo ? 'Se detectó mención a sede ajena en el footer' : 'Sede única confirmada: Leandro N. Alem 45, Gualeguaychú'
    );
  } catch (err) {
    report('Footer: Sede exclusiva en Gualeguaychú', false, `Error: ${err.message}`);
  }

  // ── 7. Footer: Especialidad canónica "Dermatóloga" ─────────────────────────
  if (homeHtml) {
    const hasDermatologa = homeHtml.includes('Dermatóloga');
    report(
      'Footer: Especialidad canónica restaurada ("Dermatóloga")',
      hasDermatologa,
      hasDermatologa ? 'Subtítulo del logo en footer: Dermatóloga' : 'No se encontró "Dermatóloga" en el footer'
    );
  }

  // ── 8. Footer: Horarios de atención en consultorio ─────────────────────────
  if (homeHtml) {
    const hasAttentionHours = homeHtml.includes('10:00 – 19:00') || homeHtml.includes('10:00 - 19:00');
    report(
      'Footer: Horarios de atención médica en consultorio (10:00 – 19:00 hs)',
      hasAttentionHours,
      hasAttentionHours ? 'Horario de consultorio verificado' : 'No se encontró horario 10:00 – 19:00 en footer'
    );
  }

  // ── 9. Ficha de producto: Título canónico e hidratado ──────────────────────
  try {
    const productSlug = 'acneplur-foam';
    const prodRes = await fetchText(`/tienda/${productSlug}`);
    const titleMatch = prodRes.text.match(/<title>([^<]+)<\/title>/i);
    const titleContent = titleMatch ? titleMatch[1].trim() : '';

    const isWellFormatted = titleContent.includes('Acneplur Foam') &&
                            titleContent.includes('Dra. Landaburo') &&
                            !titleContent.includes('Dra. Landaburo | Dra. Landaburo') &&
                            !titleContent.includes('null');

    report(
      `Ficha de producto: Título canónico e hidratado (/tienda/${productSlug})`,
      isWellFormatted,
      `Título extraído: "${titleContent}"`
    );
  } catch (err) {
    report('Ficha de producto: Título canónico', false, `Error: ${err.message}`);
  }

  // ── 10. Botón flotante de WhatsApp ─────────────────────────────────────────
  if (homeHtml) {
    const hasWaLink = homeHtml.includes('wa.me/5491169684062') || homeHtml.includes('whatsapp.com');
    report(
      'Botón flotante de WhatsApp activo en el sitio',
      hasWaLink,
      'Enlace a wa.me/5491169684062 presente en el DOM'
    );
  }

  console.log(`\n-----------------------------------------------------------------------------`);
  if (allPassed) {
    console.log(`🎉 RESULTADO GLOBAL: TODOS LOS CHEQUEOS DE PRODUCCIÓN PASARON (100% OK)`);
    console.log(`=============================================================================\n`);
    process.exit(0);
  } else {
    console.error(`⚠️ RESULTADO GLOBAL: AL MENOS UN CHEQUEO DE PRODUCCIÓN FALLÓ`);
    console.log(`=============================================================================\n`);
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Error fatal durante la verificación:', err);
  process.exit(1);
});
