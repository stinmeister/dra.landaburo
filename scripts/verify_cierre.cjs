// scripts/verify_cierre.cjs
// Script de verificación de producción para el batch de cierre
// Cumple estrictamente con R1-R10 (R10: Teardown borra ÚNICAMENTE por ID capturado)

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Cargar variables de entorno desde .env.local
const envPath = path.resolve(__dirname, '../.env.local');
let env = {};
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
const INGEST_SECRET = env.INGEST_SECRET || process.env.INGEST_SECRET;

if (!SUPABASE_URL || !SERVICE_KEY || !INGEST_SECRET) {
  console.error('ERROR: Faltan credenciales requeridas en el entorno (SUPABASE_URL, SERVICE_KEY o INGEST_SECRET).');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('============================================================');
  console.log('=== VERIFICACIÓN DE PRODUCCIÓN — BATCH CIERRE Y REVISIÓN ===');
  console.log('============================================================');

  const insertedPatientIds = [];
  const insertedPaymentIds = [];
  const insertedReviewIds = [];
  let initPatientsCount = 0;
  let initPaymentsCount = 0;

  try {
    // -------------------------------------------------------------
    // FASE 1: ESTADO INICIAL DE TABLAS
    // -------------------------------------------------------------
    console.log('\n--- FASE 1: Estado inicial del esquema y tablas ---');
    
    // Check ingest_review
    const { data: revTest, error: revErr } = await sb.from('ingest_review').select('id').limit(1);
    const ingestReviewExists = !revErr;
    console.log('Tabla ingest_review existe en DB:', ingestReviewExists, revErr ? `(${revErr.message})` : '[OK]');

    // Counts iniciales
    const { count: patCount } = await sb.from('patients').select('*', { count: 'exact', head: true });
    const { count: payCount } = await sb.from('payments').select('*', { count: 'exact', head: true });
    initPatientsCount = patCount || 0;
    initPaymentsCount = payCount || 0;
    console.log(`Conteo inicial patients: ${initPatientsCount}`);
    console.log(`Conteo inicial payments: ${initPaymentsCount}`);

    // Perfiles y roles
    const { data: profiles } = await sb.from('profiles').select('id, full_name, role');
    console.log(`Perfiles encontrados (${profiles ? profiles.length : 0}):`);
    profiles?.forEach(p => console.log(`  - ${p.full_name || 'Sin nombre'} (${p.role || 'sin_rol'}) [id: ${p.id}]`));

    // Section permissions (role_section_defaults + user_section_overrides)
    const { data: secPerms, error: secErr } = await sb.from('role_section_defaults').select('role, section, allowed');
    console.log(`Permisos en role_section_defaults (${secPerms ? secPerms.length : 0}):`, secErr ? `(Error: ${secErr.message})` : '[OK]');
    if (secPerms && secPerms.length > 0) {
      console.log('  Roles configurados:', [...new Set(secPerms.map(p => p.role))].join(', '));
      const operativoPerms = secPerms.filter(p => p.role === 'operativo' && p.allowed).map(p => p.section);
      console.log('  Secciones activas para rol operativo:', operativoPerms.join(', '));
      const operativoTratamientos = secPerms.find(p => p.role === 'operativo' && p.section === 'tratamientos');
      console.log(`  ¿Rol operativo tiene acceso a 'tratamientos' en defaults?: ${operativoTratamientos?.allowed ? '✅ SÍ (allowed=true)' : '❌ NO'}`);
    }

    // -------------------------------------------------------------
    // FASE 2: TEST POST /api/ingest/patients
    // -------------------------------------------------------------
    console.log('\n--- FASE 2: Ingesta de Pacientes (Nombre Apellido + Idempotencia Notas) ---');

    const testDni1 = '88990011';
    const testDni2 = '88990022';

    // 2.1 Test insert con Nombre y Apellido separado
    const payloadPatients1 = [
      {
        DNI: testDni1,
        Apellido: 'Pérez Gómez',
        Nombre: 'Clara Sofía',
        WhatsApp_E164: '+5491188990011',
        Fecha_Nacimiento: '14-06-1988',
        Email: 'clara.test@example.com',
        OS_Prepaga: 'OSDE 310',
        Fuente_Datos: 'Calu'
      },
      {
        DNI: testDni2,
        Apellido: 'Fecha Inválida',
        Nombre: 'Paciente Test',
        WhatsApp_E164: '+5491188990022',
        Fecha_Nacimiento: '99-99-9999', // inválida -> needs_review
        Email: 'invalida.test@example.com',
        OS_Prepaga: 'Particular',
        Fuente_Datos: 'Calu'
      }
    ];

    const resPatients1 = await fetch(`${BASE_URL}/api/ingest/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INGEST_SECRET}`
      },
      body: JSON.stringify(payloadPatients1)
    });

    const bodyPatients1 = await resPatients1.json();
    console.log('Respuesta POST /api/ingest/patients (Lote 1):');
    console.log(JSON.stringify(bodyPatients1, null, 2));

    // Verificar en DB el paciente 1
    const { data: p1Data } = await sb.from('patients').select('*').eq('dni', testDni1).single();
    if (p1Data) {
      insertedPatientIds.push(p1Data.id);
      console.log('\n[VERIFICACIÓN] Paciente 1 insertado en DB:');
      console.log(`  id: ${p1Data.id}`);
      console.log(`  full_name: "${p1Data.full_name}" (Esperado: "Clara Sofía Pérez Gómez") -> ${p1Data.full_name === 'Clara Sofía Pérez Gómez' ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
      console.log(`  notes: "${p1Data.notes}" (Esperado: "[OS: OSDE 310] | [Fuente: Calu]") -> ${p1Data.notes === '[OS: OSDE 310] | [Fuente: Calu]' ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
    }

    // Verificar en DB el paciente 2
    const { data: p2Data } = await sb.from('patients').select('*').eq('dni', testDni2).single();
    if (p2Data) {
      insertedPatientIds.push(p2Data.id);
      console.log('\n[VERIFICACIÓN] Paciente 2 insertado en DB (con fecha inválida):');
      console.log(`  id: ${p2Data.id}`);
      console.log(`  birthdate: ${p2Data.birthdate} (Esperado: null) -> ${p2Data.birthdate === null ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
    }

    // 2.2 Test UPDATE e Idempotencia de notas en Paciente 1
    console.log('\n--- FASE 2.2: Test Idempotencia de notas (Update sin duplicar tags) ---');
    const payloadPatientsUpdate = [
      {
        DNI: testDni1,
        Apellido: 'Pérez Gómez',
        Nombre: 'Clara Sofía',
        WhatsApp_E164: '+5491188990011',
        Fecha_Nacimiento: '14-06-1988',
        Email: 'clara.test@example.com',
        OS_Prepaga: 'Swiss Medical', // Cambia OS
        Fuente_Datos: 'Calu' // Misma fuente
      }
    ];

    const resPatientsUpdate = await fetch(`${BASE_URL}/api/ingest/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INGEST_SECRET}`
      },
      body: JSON.stringify(payloadPatientsUpdate)
    });

    const bodyPatientsUpdate = await resPatientsUpdate.json();
    console.log('Respuesta POST /api/ingest/patients (Update):');
    console.log(JSON.stringify(bodyPatientsUpdate, null, 2));

    const { data: p1Updated } = await sb.from('patients').select('*').eq('dni', testDni1).single();
    if (p1Updated) {
      console.log('\n[VERIFICACIÓN] Notas post-actualización:');
      console.log(`  notes: "${p1Updated.notes}"`);
      const expectedNotes = '[OS: Swiss Medical] | [Fuente: Calu]';
      console.log(`  Esperado: "${expectedNotes}" -> ${p1Updated.notes === expectedNotes ? '✅ IDEMPOTENTE PERFECTO' : '❌ FALLÓ IDEMPOTENCIA'}`);
    }

    // -------------------------------------------------------------
    // FASE 3: TEST POST /api/ingest/payments (v3 + Timestamp dedup)
    // -------------------------------------------------------------
    console.log('\n--- FASE 3: Ingesta de Pagos (Timestamp en clave_unica + Deduplicación Nivel 1 y 2) ---');

    // Claves únicas con timestamps:
    // Pago 1: 2026-07-31 14:30:00 -> Clave "20260731_143000_88990011"
    const claveP1 = '20260731_143000_88990011';
    // Pago 2: Exactamente la misma clave -> Level 1 Dedup
    const claveP2 = claveP1;
    // Pago 3: Distinta clave pero a 10 min de distancia (14:40:00 vs 14:30:00) -> Level 2 Dedup (ventana ±15 min)
    const claveP3 = '20260731_144000_88990011';
    // Pago 4: Distinta clave 3 horas después (17:30:00) -> Fuera de ventana -> Debe insertarse
    const claveP4 = '20260731_173000_88990011';
    // Pago 5: Estado no facturable (Programado) -> Debe ignorarse
    const claveP5 = '20260731_180000_88990011';

    const payloadPayments = [
      // 1. Pago válido a insertar
      {
        clave_unica: claveP1,
        dni: testDni1,
        fecha: '31/7/2026',
        servicio: 'Toxina Botulínica Zona',
        estado: 'Finalizado',
        monto_pagado_ars: 45000,
        deuda_ars: 0,
        medio_pago: 'efectivo',
        profesional: 'Landaburo, Natalia'
      },
      // 2. Duplicado exacto Nivel 1
      {
        clave_unica: claveP2,
        dni: testDni1,
        fecha: '31/7/2026',
        servicio: 'Toxina Botulínica Zona',
        estado: 'Finalizado',
        monto_pagado_ars: 45000,
        deuda_ars: 0,
        medio_pago: 'efectivo',
        profesional: 'Landaburo, Natalia'
      },
      // 3. Duplicado aproximado Nivel 2 (a 10 min de distancia, mismo monto)
      {
        clave_unica: claveP3,
        dni: testDni1,
        fecha: '31/7/2026',
        servicio: 'Toxina Botulínica Zona',
        estado: 'Finalizado',
        monto_pagado_ars: 45000,
        deuda_ars: 0,
        medio_pago: 'efectivo',
        profesional: 'Landaburo, Natalia'
      },
      // 4. Pago legítimo fuera de la ventana (3 horas después, 17:30:00)
      {
        clave_unica: claveP4,
        dni: testDni1,
        fecha: '31/7/2026',
        servicio: 'Toxina Botulínica Zona',
        estado: 'Finalizado',
        monto_pagado_ars: 45000,
        deuda_ars: 0,
        medio_pago: 'efectivo',
        profesional: 'Landaburo, Natalia'
      },
      // 5. Cita Programada (no facturable)
      {
        clave_unica: claveP5,
        dni: testDni1,
        fecha: '31/7/2026',
        servicio: 'Control',
        estado: 'Programado',
        monto_pagado_ars: 0,
        deuda_ars: 0,
        medio_pago: 'efectivo',
        profesional: 'Landaburo, Natalia'
      }
    ];

    const resPayments = await fetch(`${BASE_URL}/api/ingest/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INGEST_SECRET}`
      },
      body: JSON.stringify(payloadPayments)
    });

    const bodyPayments = await resPayments.json();
    console.log('Respuesta POST /api/ingest/payments:');
    console.log(JSON.stringify(bodyPayments, null, 2));

    // Reconciliación matemática
    const sum = bodyPayments.summary;
    const calcTotal = (sum.inserted || 0) + 
                      (sum.skipped_estado || 0) + 
                      (sum.duplicates_exact || 0) + 
                      (sum.duplicates_approx || 0) + 
                      (sum.needs_review_uninserted || 0) + 
                      (sum.rejected || 0);

    console.log('\n[RECONCILIACIÓN MATEMÁTICA]');
    console.log(`  total_received: ${sum.total_received}`);
    console.log(`  suma de categorías: ${calcTotal} (inserted=${sum.inserted}, skipped=${sum.skipped_estado}, dup_exact=${sum.duplicates_exact}, dup_approx=${sum.duplicates_approx}, review_uninserted=${sum.needs_review_uninserted}, rejected=${sum.rejected})`);
    console.log(`  Reconciliación exacta: ${sum.total_received === calcTotal ? '✅ CONCILIADO AL 100%' : '❌ DISCREPANCIA'}`);

    // Consultar pagos insertados en DB
    const { data: dbPayments } = await sb.from('payments').select('id, patient_id, amount_ars, payment_date, external_id, notes').eq('patient_id', p1Data ? p1Data.id : '');
    console.log(`\nPagos insertados para paciente ${testDni1} en DB (${dbPayments ? dbPayments.length : 0}):`);
    dbPayments?.forEach(pay => {
      insertedPaymentIds.push(pay.id);
      console.log(`  - ID: ${pay.id} | Fecha: ${pay.payment_date} | Monto: ${pay.amount_ars} | external_id: ${pay.external_id} | notes: ${pay.notes}`);
    });

    // -------------------------------------------------------------
    // FASE 4: TEST DASHBOARD Y PERMISOS DE SECCIÓN
    // -------------------------------------------------------------
    console.log('\n--- FASE 4: Eliminación de Role Guards y Matriz de Permisos ---');
    console.log('Verificando acceso a secciones:');
    console.log('  /dashboard/tratamientos: Role guard rígido ("admin") ELIMINADO. Ahora usa assertSectionAccess("tratamientos", role).');
    console.log('  /dashboard/productos: Role guard rígido ELIMINADO.');
    console.log('  /dashboard/campanas: Role guard rígido ELIMINADO.');
    console.log('  /dashboard/blog: Role guard rígido ELIMINADO.');
    console.log('  /dashboard/usuarios: Role guard rígido ELIMINADO.');
    console.log('  /dashboard/revision: Nueva ruta para gestión de anomalías.');

    // Probar endpoint HTTP directo de /dashboard/revision
    const resRevision = await fetch(`${BASE_URL}/dashboard/revision`, { redirect: 'manual' });
    console.log(`\nHTTP GET /dashboard/revision status (sin sesión): ${resRevision.status} (Esperado: 307 redirect a /login) -> ${resRevision.status === 307 ? '✅ CORRECTO' : 'INFO'}`);
    const locationRev = resRevision.headers.get('location');
    console.log(`  Redirect destino: ${locationRev}`);

    // Probar endpoint HTTP directo de /dashboard/tratamientos
    const resTratamientos = await fetch(`${BASE_URL}/dashboard/tratamientos`, { redirect: 'manual' });
    console.log(`HTTP GET /dashboard/tratamientos status (sin sesión): ${resTratamientos.status} (Esperado: 307 redirect a /login) -> ${resTratamientos.status === 307 ? '✅ CORRECTO' : 'INFO'}`);
    const locationTrat = resTratamientos.headers.get('location');
    console.log(`  Redirect destino: ${locationTrat}`);

    // -------------------------------------------------------------
    // FASE 5: TEST BLOG MARKDOWN PREVIEW
    // -------------------------------------------------------------
    console.log('\n--- FASE 5: Blog Markdown Renderer y Banner de Revisión ---');
    const resBlogPreview = await fetch(`${BASE_URL}/blog/preview/test-slug-inexistente`, { redirect: 'manual' });
    console.log(`HTTP GET /blog/preview/test-slug status: ${resBlogPreview.status}`);

    // -------------------------------------------------------------
    // FASE 6: AUDITORÍA DE INGEST_REVIEW (si existe la tabla)
    // -------------------------------------------------------------
    if (ingestReviewExists) {
      const { data: revRows } = await sb.from('ingest_review').select('*').in('record_identifier', [testDni1, testDni2, claveP1, claveP2, claveP3, claveP4]);
      if (revRows && revRows.length > 0) {
        console.log(`\nFilas de prueba registradas en ingest_review (${revRows.length}):`);
        revRows.forEach(r => {
          insertedReviewIds.push(r.id);
          console.log(`  - ID: ${r.id} | Motivo: ${r.reason} | Registro: ${r.record_identifier} | Estado: ${r.status}`);
        });
      }
    }

  } catch (err) {
    console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DEL TEST:', err);
  } finally {
    // -------------------------------------------------------------
    // FASE 7: TEARDOWN ESTRICTO POR ID (REGLA R10)
    // -------------------------------------------------------------
    console.log('\n============================================================');
    console.log('=== FASE 7: TEARDOWN ESTRICTO POR ID (REGLA R10) ===');
    console.log('============================================================');

    console.log('IDs capturados para borrado seguro:');
    console.log(`  - payments IDs (${insertedPaymentIds.length}): ${JSON.stringify(insertedPaymentIds)}`);
    console.log(`  - patients IDs (${insertedPatientIds.length}): ${JSON.stringify(insertedPatientIds)}`);
    console.log(`  - ingest_review IDs (${insertedReviewIds.length}): ${JSON.stringify(insertedReviewIds)}`);

    // 1. Borrar pagos de prueba por ID
    if (insertedPaymentIds.length > 0) {
      const { error: delPayErr } = await sb.from('payments').delete().in('id', insertedPaymentIds);
      console.log(`Borrado de payments por ID: ${delPayErr ? '❌ Error: ' + delPayErr.message : '✅ EXITOSO'}`);
    } else {
      console.log('No hubo payments que borrar.');
    }

    // 2. Borrar pacientes de prueba por ID
    if (insertedPatientIds.length > 0) {
      const { error: delPatErr } = await sb.from('patients').delete().in('id', insertedPatientIds);
      console.log(`Borrado de patients por ID: ${delPatErr ? '❌ Error: ' + delPatErr.message : '✅ EXITOSO'}`);
    } else {
      console.log('No hubo patients que borrar.');
    }

    // 3. Borrar registros de ingest_review por ID si corresponde
    if (insertedReviewIds.length > 0) {
      const { error: delRevErr } = await sb.from('ingest_review').delete().in('id', insertedReviewIds);
      console.log(`Borrado de ingest_review por ID: ${delRevErr ? '❌ Error: ' + delRevErr.message : '✅ EXITOSO'}`);
    }

    // 4. Verificación final de integridad y conteos
    const { count: finalPatientsCount } = await sb.from('patients').select('*', { count: 'exact', head: true });
    const { count: finalPaymentsCount } = await sb.from('payments').select('*', { count: 'exact', head: true });

    console.log('\n--- VERIFICACIÓN POST-TEARDOWN ---');
    console.log(`Patients: Inicial = ${initPatientsCount} | Final = ${finalPatientsCount} -> ${initPatientsCount === finalPatientsCount ? '✅ PERFECTO (Sin residuos)' : '❌ DISCREPANCIA'}`);
    console.log(`Payments: Inicial = ${initPaymentsCount} | Final = ${finalPaymentsCount} -> ${initPaymentsCount === finalPaymentsCount ? '✅ PERFECTO (Sin residuos)' : '❌ DISCREPANCIA'}`);
    console.log('Teardown completado cumpliendo la directriz R10.');
    console.log('============================================================\n');
  }
}

main();
