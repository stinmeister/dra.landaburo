/**
 * scripts/verify-produccion.mjs
 * Script de verificación automatizada anti-fallbacks contra la URL pública de producción y Supabase.
 *
 * Principio rector:
 * Un chequeo que no distingue "funciona" de "cayó al fallback" no está verificando nada.
 * Donde haya un valor configurable, el chequeo confirma que el sitio refleja el valor real
 * almacenado en la base de datos (PostgreSQL), nunca una constante estática hardcodeada.
 */

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const BASE_URL = process.env.VERIFY_BASE_URL || 'https://dralandaburo.com';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const sbAdmin = (SUPABASE_URL && SERVICE_KEY) ? createClient(SUPABASE_URL, SERVICE_KEY) : null;
const sbAnon = (SUPABASE_URL && ANON_KEY) ? createClient(SUPABASE_URL, ANON_KEY) : null;

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
  console.log(`🔍 VERIFICACIÓN DE PRODUCCIÓN ANTI-FALLBACKS — ${BASE_URL}`);
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

  // ── 8. Footer: Horarios dinámicos contrastados contra store_config (DB) ────
  if (sbAdmin) {
    try {
      const { data: dbConfig, error: scErr } = await sbAdmin
        .from('store_config')
        .select('attention_hours')
        .eq('id', 1)
        .single();

      if (scErr || !dbConfig?.attention_hours) {
        report('Footer: Horarios dinámicos contrastados contra DB', false, `Error consultando store_config: ${scErr?.message}`);
      } else {
        const expectedHours = dbConfig.attention_hours.trim();
        // Normalizamos espacios y guiones para robustez de comparación
        const normExpected = expectedHours.replace(/[\s\u2013\u2014-]+/g, ' ').toLowerCase();
        const normHtml = homeHtml.replace(/[\s\u2013\u2014-]+/g, ' ').toLowerCase();

        const matchesDb = normHtml.includes(normExpected) || homeHtml.includes(expectedHours);
        report(
          'Footer: Horarios de atención reflejan dinámicamente store_config (DB)',
          matchesDb,
          matchesDb
            ? `HTML público coincide exactamente con el valor en PostgreSQL: "${expectedHours}"`
            : `El HTML no contiene el valor configurado en base de datos ("${expectedHours}")`
        );
      }
    } catch (err) {
      report('Footer: Horarios dinámicos contrastados contra DB', false, `Error: ${err.message}`);
    }
  } else {
    report('Footer: Horarios dinámicos contrastados contra DB', false, 'Faltan credenciales de Supabase para contrastar contra DB');
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

  // ── 11. Rate Limits persistente en PostgreSQL (FIX-029) ────────────────────
  if (sbAdmin) {
    try {
      const testKey = 'verify-check-rate-limit';
      const now = new Date();
      const resetAt = new Date(now.getTime() + 60000);

      // Inserción directa en tabla
      const { error: insErr } = await sbAdmin.from('rate_limits').upsert({
        key: testKey,
        count: 1,
        reset_at: resetAt.toISOString(),
        updated_at: now.toISOString(),
      });

      if (insErr) {
        report('Rate limits persistente en PostgreSQL (public.rate_limits)', false, `Error al escribir en tabla: ${insErr.message}`);
      } else {
        const { data: readRow, error: readErr } = await sbAdmin
          .from('rate_limits')
          .select('key, count')
          .eq('key', testKey)
          .single();

        const isOk = !readErr && readRow?.count === 1;
        report(
          'Rate limits persistente en PostgreSQL (public.rate_limits)',
          isOk,
          isOk ? 'Tabla public.rate_limits operativa con inserción y lectura' : `Error en lectura: ${readErr?.message}`
        );

        // Limpiar registro de test
        await sbAdmin.from('rate_limits').delete().eq('key', testKey);
      }
    } catch (err) {
      report('Rate limits persistente en PostgreSQL', false, `Excepción: ${err.message}`);
    }
  }

  // ── 12. Idempotencia real con tabla mp_webhook_events ──────────────────────
  if (sbAdmin) {
    try {
      const testEventId = 'verify-test-event-idempotency';
      await sbAdmin.from('mp_webhook_events').delete().eq('event_id', testEventId);

      // 1er insert
      const { error: insErr1 } = await sbAdmin.from('mp_webhook_events').insert({
        event_id: testEventId,
        payment_id: 'verify-payment-1',
        status: 'received',
        payload: { test: true },
      });

      // 2do insert (debe chocar por UNIQUE constraint 23505)
      const { error: insErr2 } = await sbAdmin.from('mp_webhook_events').insert({
        event_id: testEventId,
        payment_id: 'verify-payment-1',
        status: 'received',
        payload: { test: true },
      });

      const uniqueEnforced = !insErr1 && insErr2 && insErr2.code === '23505';
      report(
        'Idempotencia estricta en mp_webhook_events (rechazo de duplicados por UNIQUE)',
        Boolean(uniqueEnforced),
        uniqueEnforced
          ? 'Evento duplicado rechazado por restricción UNIQUE de PostgreSQL (código 23505)'
          : `Fallo de unicidad: insErr1=${insErr1?.message}, insErr2=${insErr2?.message}`
      );

      await sbAdmin.from('mp_webhook_events').delete().eq('event_id', testEventId);
    } catch (err) {
      report('Idempotencia estricta en mp_webhook_events', false, `Excepción: ${err.message}`);
    }
  }

  // ── 13. Formulario de contacto: inserción anónima sin service_role ─────────
  if (sbAnon && sbAdmin) {
    try {
      const testAnonEmail = 'qa.verify.script.anon@dralandaburo.local';
      await sbAdmin.from('leads').delete().eq('email', testAnonEmail);

      const testPayload = {
        full_name: 'QA Verifier Script Anon',
        email: testAnonEmail,
        phone: '+5493446000000',
        notes: '[QA VERIFIER SCRIPT] Prueba de inserción anónima con RLS activa',
        status: 'nuevo',
      };

      // Inserción con cliente anónimo (sin .select())
      const { error: anonInsErr } = await sbAnon.from('leads').insert([testPayload]);

      if (anonInsErr) {
        report(
          'Formulario de contacto: Inserción anónima con RLS activa (leads_anon_insert)',
          false,
          `Error RLS: ${anonInsErr.message} (código ${anonInsErr.code})`
        );
      } else {
        // Verificar existencia con admin
        const { data: leadRow } = await sbAdmin
          .from('leads')
          .select('id, status')
          .eq('email', testAnonEmail)
          .maybeSingle();

        const success = Boolean(leadRow && leadRow.status === 'nuevo');
        report(
          'Formulario de contacto: Inserción anónima con RLS activa (leads_anon_insert)',
          success,
          success
            ? `Lead registrado correctamente en DB con rol anon (id: ${leadRow.id})`
            : 'Fila no encontrada tras inserción anónima'
        );

        if (leadRow) {
          await sbAdmin.from('leads').delete().eq('id', leadRow.id);
        }
      }
    } catch (err) {
      report('Formulario de contacto: Inserción anónima con RLS activa', false, `Excepción: ${err.message}`);
    }
  }

  // ── 14. Columnas Meta CAPI confirmadas en orders ───────────────────────────
  if (sbAdmin) {
    try {
      const { error: capiErr } = await sbAdmin
        .from('orders')
        .select('meta_capi_status, meta_capi_event_id, meta_capi_sent_at, meta_capi_error')
        .limit(1);

      report(
        'Columnas de Meta CAPI activas en tabla orders (sin modo defensivo)',
        !capiErr,
        capiErr ? `Error en esquema: ${capiErr.message}` : 'Columnas meta_capi_status/event_id/sent_at/error verificadas'
      );
    } catch (err) {
      report('Columnas de Meta CAPI activas en tabla orders', false, `Excepción: ${err.message}`);
    }
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
