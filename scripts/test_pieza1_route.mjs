import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INGEST_SECRET = process.env.INGEST_SECRET;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// We can test the handler directly by importing it or running mock requests!
// In Next.js App Router, we can import POST from the route file using tsx or node with loader,
// OR we can test via local dev server if running, OR we can test directly via imported handler!
// Let's test the route logic directly using mock NextRequest.

import { POST } from '../src/app/api/ingest/payments/route.ts';

function createMockRequest(body, authHeader = `Bearer ${INGEST_SECRET}`) {
  return {
    headers: new Headers({
      'content-type': 'application/json',
      'authorization': authHeader,
    }),
    json: async () => body,
  };
}

async function runTests() {
  console.log('=== TEST SUITE: PIEZA 1 (POST /api/ingest/payments) ===\n');
  let passed = 0;
  let failed = 0;

  function report(name, ok, details = '') {
    if (ok) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${name} — ${details}`);
      failed++;
    }
  }

  const cleanIds = [];

  try {
    // ── Test 1: Fecha faltante -> 400 ─────────────────────────────────────────
    {
      const req = createMockRequest({
        source: 'pagos',
        rows: [
          {
            external_key: 'test:missing_date:1',
            movement_type: 'ingreso',
            // payment_date is MISSING
            payer_name_raw: 'TEST PACIENTE',
            payment_method: 'efectivo',
            currency: 'ARS',
            amount: 5000,
          },
        ],
      });
      const res = await POST(req);
      const json = await res.json();
      report(
        '1. Fecha faltante rechaza con 400 (fail-closed, no default)',
        res.status === 400 && json.error?.includes('payment_date'),
        `HTTP ${res.status} — ${json.error}`
      );
    }

    // ── Test 2: Un pago de hoy de una deuda vieja guarda su payment_date ───────
    const testDate = '2026-09-15T14:20:00-03:00';
    const testKey2 = `test:calu:pago_viejo:${Date.now()}`;
    {
      const req = createMockRequest({
        source: 'pagos',
        rows: [
          {
            external_key: testKey2,
            movement_type: 'ingreso',
            payment_date: testDate,
            payer_name_raw: 'Cantero, Isabella', // existing patient in DB!
            description: 'Pago de deuda anterior',
            payment_method: 'efectivo',
            origin_raw: 'natalia.landaburo',
            currency: 'ARS',
            amount: 75000,
          },
        ],
      });
      const res = await POST(req);
      const json = await res.json();
      cleanIds.push(testKey2);

      // Verify in DB
      const { data: dbRow } = await sb.from('payments').select('*').eq('external_id', testKey2).single();
      const dateMatches = dbRow && new Date(dbRow.payment_date).toISOString() === new Date(testDate).toISOString();
      const patientMatched = dbRow && dbRow.patient_id !== null;
      const profMatched = dbRow && dbRow.professional_profile_id !== null;

      report(
        '2. Pago guarda payment_date del payload (no now()) y resuelve identidades',
        res.status === 200 && json.rows_inserted === 1 && dateMatches && patientMatched && profMatched,
        `DB payment_date: ${dbRow?.payment_date}, patient_id: ${dbRow?.patient_id}, prof_id: ${dbRow?.professional_profile_id}`
      );
    }

    // ── Test 3: Correr dos veces no duplica (idempotencia) ────────────────────
    {
      const req = createMockRequest({
        source: 'pagos',
        rows: [
          {
            external_key: testKey2, // Same key as Test 2!
            movement_type: 'ingreso',
            payment_date: testDate,
            payer_name_raw: 'Cantero, Isabella',
            payment_method: 'efectivo',
            currency: 'ARS',
            amount: 75000,
          },
        ],
      });
      const res = await POST(req);
      const json = await res.json();

      report(
        '3. Correr dos veces no duplica (rows_inserted: 0, rows_duplicated: 1)',
        res.status === 200 && json.rows_inserted === 0 && json.rows_duplicated === 1,
        `rows_inserted: ${json.rows_inserted}, rows_duplicated: ${json.rows_duplicated}`
      );
    }

    // ── Test 4: Pagador no identificado entra igual con payer_name ───────────
    const testKey4 = `test:calu:pagador_desconocido:${Date.now()}`;
    {
      const req = createMockRequest({
        source: 'pagos',
        rows: [
          {
            external_key: testKey4,
            movement_type: 'ingreso',
            payment_date: '2026-10-15T10:00:00-03:00',
            payer_name_raw: 'NO_EXISTE_ESTE_PACIENTE_EN_PADRON, FULANO',
            payment_method: 'transferencia',
            currency: 'ARS',
            amount: 30000,
          },
        ],
      });
      const res = await POST(req);
      const json = await res.json();
      cleanIds.push(testKey4);

      const { data: dbRow } = await sb.from('payments').select('*').eq('external_id', testKey4).single();
      const patientIsNull = dbRow && dbRow.patient_id === null;
      const payerNamePreserved = dbRow && dbRow.payer_name === 'NO_EXISTE_ESTE_PACIENTE_EN_PADRON, FULANO';

      report(
        '4. Pagador no identificado entra con patient_id null y payer_name cargado',
        res.status === 200 && json.rows_inserted === 1 && patientIsNull && payerNamePreserved,
        `patient_id: ${dbRow?.patient_id}, payer_name: "${dbRow?.payer_name}"`
      );
    }

    // ── Test 5: Medio no mapeado va a ingest_review, no a payments ───────────
    const testKey5 = `test:calu:medio_invalido:${Date.now()}`;
    {
      const req = createMockRequest({
        source: 'pagos',
        rows: [
          {
            external_key: testKey5,
            movement_type: 'ingreso',
            payment_date: '2026-10-15T11:00:00-03:00',
            payer_name_raw: 'Cantero, Isabella',
            payment_method: 'tarjeta_credito', // Fuera del CHECK!
            currency: 'ARS',
            amount: 50000,
          },
        ],
      });
      const res = await POST(req);
      const json = await res.json();

      const { data: dbPayment } = await sb.from('payments').select('id').eq('external_id', testKey5).maybeSingle();
      const notInPayments = dbPayment === null;

      const { data: dbReview } = await sb
        .from('ingest_review')
        .select('*')
        .eq('record_identifier', testKey5)
        .eq('reason', 'medio_de_pago_no_mapeado')
        .maybeSingle();

      report(
        '5. Medio no mapeado (tarjeta_credito) va a ingest_review, no a payments',
        res.status === 200 && json.rows_in_review === 1 && json.review_reasons?.medio_de_pago_no_mapeado === 1 && notInPayments && !!dbReview,
        `in_review: ${json.rows_in_review}, in_payments: ${!notInPayments}, in_review_db: ${!!dbReview}`
      );

      if (dbReview?.id) {
        await sb.from('ingest_review').delete().eq('id', dbReview.id);
      }
    }

    // ── Test 6: Moneda incoherente se rechaza por la base ─────────────────────
    {
      const req = createMockRequest({
        source: 'pagos',
        rows: [
          {
            external_key: `test:incoherence:${Date.now()}`,
            movement_type: 'ingreso',
            payment_date: '2026-10-15T12:00:00-03:00',
            payer_name_raw: 'Cantero, Isabella',
            payment_method: 'efectivo',
            currency: 'USD',
            amount: 100,
            amount_ars: 100, // Fuerza incoherencia USD con amount_ars > 0
          },
        ],
      });
      const res = await POST(req);
      const json = await res.json();

      report(
        '6. Moneda incoherente rechazada por check constraint de la base',
        res.status === 400 && json.error?.includes('check constraint'),
        `HTTP ${res.status} — ${json.error}`
      );
    }

  } finally {
    // Limpieza de datos de prueba
    for (const key of cleanIds) {
      await sb.from('payments').delete().eq('external_id', key);
    }
  }

  console.log(`\n======================================================`);
  console.log(`RESULTADO PIEZA 1: ${passed} pasados, ${failed} fallados`);
  console.log(`======================================================\n`);
}

runTests().catch(console.error);
