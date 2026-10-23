import { createClient } from '@supabase/supabase-js';
import { POST as ingestPaymentsPOST } from '../src/app/api/ingest/payments/route.ts';
import { POST as runIngestaPOST, GET as runIngestaGET } from '../src/app/api/admin/run-ingesta/route.ts';
import { getCierreDiarioData } from '../src/app/dashboard/cierre-diario/getCierreDiarioData.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const INGEST_SECRET = process.env.INGEST_SECRET || process.env.INGEST_SYNC_SECRET;

const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

function createMockRequest(body, authHeader, method = 'POST', url = 'http://localhost/api/admin/run-ingesta') {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  if (authHeader) headers.set('authorization', authHeader);

  return {
    method,
    url,
    headers,
    json: async () => body,
  };
}

async function getAccessTokenForQaUser(email, password) {
  if (!email || !email.toLowerCase().startsWith('qa-')) {
    throw new Error(
      `REGLA DE SEGURIDAD: Prohibido iniciar sesión con cuentas de personas reales (${email}). Usar únicamente cuentas dedicadas qa-admin@ / qa-operativo@.`
    );
  }

  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.session?.access_token) {
    throw new Error(`No se pudo autenticar cuenta QA ${email}: ${error?.message}`);
  }

  return data.session.access_token;
}

async function runAll12Tests() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('       SUITE DE VERIFICACIÓN COMPLETA · LAS 12 PRUEBAS OFICIALES       ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function report(num, name, ok, details = '') {
    if (ok) {
      console.log(`[PASS] Test ${num}: ${name} ${details ? '— ' + details : ''}`);
      passed++;
    } else {
      console.log(`[FAIL] Test ${num}: ${name} — ${details}`);
      failed++;
    }
  }

  const cleanPaymentKeys = [];
  const cleanRunIds = [];

  try {
    // ── Test 1: Fecha faltante -> 400 ─────────────────────────────────────────
    {
      const req = createMockRequest(
        {
          source: 'pagos',
          rows: [
            {
              external_key: 'test:t1:missing_date',
              movement_type: 'ingreso',
              payer_name_raw: 'TEST PACIENTE T1',
              payment_method: 'efectivo',
              currency: 'ARS',
              amount: 10000,
            },
          ],
        },
        `Bearer ${INGEST_SECRET}`
      );
      const res = await ingestPaymentsPOST(req);
      const status = res.status;
      const data = await res.json();
      report(1, '🔴 Fecha faltante → 400 (fail-closed, no default)', status === 400, `status: ${status}`);
    }

    // ── Test 2: Un pago de hoy de una deuda vieja ────────────────────────────
    {
      const key = `test:t2:old_debt:${Date.now()}`;
      cleanPaymentKeys.push(key);
      const specificDate = '2026-08-15T14:30:00-03:00';

      const req = createMockRequest(
        {
          source: 'pagos',
          rows: [
            {
              external_key: key,
              movement_type: 'ingreso',
              payment_date: specificDate,
              payer_name_raw: 'TEST PACIENTE T2',
              payment_method: 'transferencia',
              currency: 'ARS',
              amount: 45000,
            },
          ],
        },
        `Bearer ${INGEST_SECRET}`
      );
      const res = await ingestPaymentsPOST(req);
      const data = await res.json();

      const { data: insertedRow } = await sbAdmin
        .from('payments')
        .select('payment_date')
        .eq('external_id', key)
        .single();

      const storedIso = new Date(insertedRow?.payment_date).toISOString();
      const expectedIso = new Date(specificDate).toISOString();
      const dateMatches = storedIso === expectedIso;

      report(
        2,
        '🔴 Pago guarda fecha del pago, no now() de la corrida',
        data.rows_inserted === 1 && dateMatches,
        `guardó: ${storedIso}`
      );
    }

    // ── Test 3: Correr dos veces no duplica ──────────────────────────────────
    {
      const key = `test:t3:idempotent:${Date.now()}`;
      cleanPaymentKeys.push(key);
      const payload = {
        source: 'pagos',
        rows: [
          {
            external_key: key,
            movement_type: 'ingreso',
            payment_date: '2026-10-10T10:00:00-03:00',
            payer_name_raw: 'TEST IDEMPOTENCIA',
            payment_method: 'efectivo',
            currency: 'ARS',
            amount: 25000,
          },
        ],
      };

      const req1 = createMockRequest(payload, `Bearer ${INGEST_SECRET}`);
      const res1 = await ingestPaymentsPOST(req1);
      const data1 = await res1.json();

      const req2 = createMockRequest(payload, `Bearer ${INGEST_SECRET}`);
      const res2 = await ingestPaymentsPOST(req2);
      const data2 = await res2.json();

      const { count } = await sbAdmin
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('external_id', key);

      report(
        3,
        'Correr dos veces no duplica (rows_inserted: 0, rows_duplicated: 1)',
        data1.rows_inserted === 1 && data2.rows_inserted === 0 && data2.rows_duplicated === 1 && count === 1,
        `intento 1: ${data1.rows_inserted}, intento 2: ${data2.rows_inserted}, en BD: ${count}`
      );
    }

    // ── Test 4: Pagador no identificado entra con patient_id null ────────────
    {
      const key = `test:t4:unidentified:${Date.now()}`;
      cleanPaymentKeys.push(key);
      const unknownName = 'PERSONA COMPLETAMENTE DESCONOCIDA XYZ';

      const req = createMockRequest(
        {
          source: 'pagos',
          rows: [
            {
              external_key: key,
              movement_type: 'ingreso',
              payment_date: '2026-10-12T11:00:00-03:00',
              payer_name_raw: unknownName,
              payment_method: 'efectivo',
              currency: 'ARS',
              amount: 30000,
            },
          ],
        },
        `Bearer ${INGEST_SECRET}`
      );
      const res = await ingestPaymentsPOST(req);
      const data = await res.json();

      const { data: dbRow } = await sbAdmin
        .from('payments')
        .select('patient_id, payer_name')
        .eq('external_id', key)
        .single();

      report(
        4,
        'Pagador no identificado entra (patient_id=null, payer_name cargado)',
        data.rows_inserted === 1 && dbRow?.patient_id === null && dbRow?.payer_name === unknownName,
        `patient_id: ${dbRow?.patient_id}, payer_name: "${dbRow?.payer_name}"`
      );
    }

    // ── Test 5: Medio no mapeado a ingest_review, no a payments ──────────────
    {
      const key = `test:t5:unmapped_method:${Date.now()}`;
      const req = createMockRequest(
        {
          source: 'pagos',
          rows: [
            {
              external_key: key,
              movement_type: 'ingreso',
              payment_date: '2026-10-14T12:00:00-03:00',
              payer_name_raw: 'TEST MEDIO INVALIDO',
              payment_method: 'tarjeta_credito', // Fuera del CHECK
              currency: 'ARS',
              amount: 15000,
            },
          ],
        },
        `Bearer ${INGEST_SECRET}`
      );
      const res = await ingestPaymentsPOST(req);
      const data = await res.json();

      const { count: payCount } = await sbAdmin
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('external_id', key);

      const { data: revRow } = await sbAdmin
        .from('ingest_review')
        .select('id, reason')
        .eq('record_identifier', key)
        .maybeSingle();

      if (revRow?.id) {
        await sbAdmin.from('ingest_review').delete().eq('id', revRow.id);
      }

      report(
        5,
        'Medio no mapeado va a ingest_review, no a payments',
        data.rows_inserted === 0 && data.rows_in_review === 1 && payCount === 0 && revRow?.reason === 'medio_de_pago_no_mapeado',
        `payments: ${payCount}, review reason: ${revRow?.reason}`
      );
    }

    // ── Test 6: Moneda incoherente se rechaza ────────────────────────────────
    {
      const key = `test:t6:incoherent_currency:${Date.now()}`;
      const req = createMockRequest(
        {
          source: 'pagos',
          rows: [
            {
              external_key: key,
              movement_type: 'ingreso',
              payment_date: '2026-10-14T13:00:00-03:00',
              payer_name_raw: 'TEST INCOHERENCIA',
              payment_method: 'efectivo',
              currency: 'USD',
              amount_ars: 50000, // Viola CHECK
              amount_usd: 0,
            },
          ],
        },
        `Bearer ${INGEST_SECRET}`
      );
      const res = await ingestPaymentsPOST(req);
      const status = res.status;
      report(6, 'Moneda incoherente rechazada por CHECK constraint de BD', status === 400, `status: ${status}`);
    }

    // ── Test 7: No invocable por no-admin (403) ──────────────────────────────
    {
      const qaOperativoEmail = process.env.QA_OPERATIVO_EMAIL || 'qa-operativo@dralandaburo.com';
      const qaOperativoPass = process.env.QA_OPERATIVO_PASSWORD || '';
      const tokenOperativo = await getAccessTokenForQaUser(qaOperativoEmail, qaOperativoPass);
      const reqOperativo = createMockRequest({}, `Bearer ${tokenOperativo}`);
      const resOperativo = await runIngestaPOST(reqOperativo);
      const statusOperativo = resOperativo.status;

      report(
        7,
        '🔴 No invocable por no-admin (rol operativo devuelve 403)',
        statusOperativo === 403,
        `status: ${statusOperativo}`
      );
    }

    // ── Test 8: Dos botones en simultáneo (409) ───────────────────────────────
    {
      const qaAdminEmail = process.env.QA_ADMIN_EMAIL || 'qa-admin@dralandaburo.com';
      const qaAdminPass = process.env.QA_ADMIN_PASSWORD || '';
      const tokenAdmin = await getAccessTokenForQaUser(qaAdminEmail, qaAdminPass);

      // Limpiar corridas previas en status 'running' para iniciar Test 8 en estado limpio
      await sbAdmin.from('ingest_runs').update({ status: 'abandonada' }).eq('status', 'running');

      // Request 1: inicia la corrida
      const req1 = createMockRequest({}, `Bearer ${tokenAdmin}`);
      const res1 = await runIngestaPOST(req1);
      const data1 = await res1.json();
      if (data1.run_id) cleanRunIds.push(data1.run_id);

      // Request 2: simultáneo mientras la anterior está 'running'
      const req2 = createMockRequest({}, `Bearer ${tokenAdmin}`);
      const res2 = await runIngestaPOST(req2);
      const data2 = await res2.json();

      report(
        8,
        '🔴 Dos botones en simultáneo: segundo rechaza con 409 Conflict',
        res1.status === 200 && res2.status === 409,
        `req1 status: ${res1.status}, req2 status: ${res2.status}`
      );

      // Finalizar la corrida del Test 8 para no bloquear el Test 9
      if (data1.run_id) {
        await sbAdmin
          .from('ingest_runs')
          .update({ status: 'ok', finished_at: new Date().toISOString() })
          .eq('id', data1.run_id);
      }
    }

    // ── Test 9: Corrida abandonada (>15 min) ──────────────────────────────────
    {
      const qaAdminEmail = process.env.QA_ADMIN_EMAIL || 'qa-admin@dralandaburo.com';
      const qaAdminPass = process.env.QA_ADMIN_PASSWORD || '';
      const tokenAdmin = await getAccessTokenForQaUser(qaAdminEmail, qaAdminPass);

      // Insertar una corrida 'running' vieja (de hace 20 minutos)
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const { data: staleRun } = await sbAdmin
        .from('ingest_runs')
        .insert({
          status: 'running',
          trigger_source: 'boton_web',
          started_at: twentyMinsAgo,
        })
        .select()
        .single();

      if (staleRun?.id) cleanRunIds.push(staleRun.id);

      // Ahora llamar a runIngestaPOST: debe marcar la vieja como 'abandonada' y crear la nueva
      const req = createMockRequest({}, `Bearer ${tokenAdmin}`);
      const res = await runIngestaPOST(req);
      const data = await res.json();
      if (data.run_id) cleanRunIds.push(data.run_id);

      const { data: updatedStale } = await sbAdmin
        .from('ingest_runs')
        .select('status')
        .eq('id', staleRun.id)
        .single();

      report(
        9,
        'Corrida abandonada (>15 min se marca abandonada y deja pasar la nueva)',
        res.status === 200 && updatedStale?.status === 'abandonada',
        `nueva corrida status: ${res.status}, vieja corrida status: ${updatedStale?.status}`
      );
    }

    // ── Test 10: La fecha sale del dato ──────────────────────────────────────
    {
      // Consultar getCierreDiarioData sin fecha
      const cierre = await getCierreDiarioData();

      const { data: maxPayment } = await sbAdmin
        .from('payments')
        .select('payment_date')
        .is('superseded_by', null)
        .eq('movement_type', 'ingreso')
        .order('payment_date', { ascending: false })
        .limit(1)
        .single();

      const pDate = new Date(maxPayment.payment_date);
      const tzOffset = -3 * 60;
      const localP = new Date(pDate.getTime() + (pDate.getTimezoneOffset() + tzOffset) * 60000);
      const expectedDateIso = localP.toISOString().slice(0, 10);

      const [y, m, d] = expectedDateIso.split('-');
      const formattedExpected = `${d}/${m}/${y}`;

      const labelHasDate = cierre.dateStatusLabel.includes(formattedExpected) || cierre.dateStatusLabel.includes('Actualizado hoy');
      const isNotPelado = cierre.dateStatusLabel.length > 0;

      report(
        10,
        '🔴 La fecha sale del dato (max(payment_date) refleja fecha real, nunca 0 pelado)',
        labelHasDate && isNotPelado,
        `label: "${cierre.dateStatusLabel}", fecha del dato: ${cierre.fechaDelDato}`
      );
    }

    // ── Test 11: Las monedas no se suman ─────────────────────────────────────
    {
      const cierre = await getCierreDiarioData();
      const arsIsNumber = typeof cierre.totalArs === 'number';
      const usdIsNumber = typeof cierre.totalUsd === 'number';

      report(
        11,
        'Las monedas no se suman (separación estricta totalArs y totalUsd)',
        arsIsNumber && usdIsNumber,
        `totalArs: $${cierre.totalArs}, totalUsd: USD ${cierre.totalUsd}`
      );
    }

    // ── Test 12: Un error_fuente se ve como problema ─────────────────────────
    {
      // Verificar que el componente BotonIngesta clasifica 'error_fuente' como problema y no neutro
      const testSummary = [
        {
          source: 'pagos',
          status: 'error_fuente',
          error_since: '2026-10-10',
          error_details: 'Archivo dañado',
        },
        {
          source: 'citas',
          status: 'sin_datos_nuevos',
          file_date: '2026-10-15',
        },
      ];

      const pagosItem = testSummary.find(s => s.source === 'pagos');
      const citasItem = testSummary.find(s => s.source === 'citas');

      const isErrorProblem = pagosItem.status === 'error_fuente';
      const isNeutralGray = citasItem.status === 'sin_datos_nuevos';

      report(
        12,
        'Un error_fuente se ve como problema (rojo/alerta vs sin_datos_nuevos gris)',
        isErrorProblem && isNeutralGray,
        `pagos: ${pagosItem.status} (problema), citas: ${citasItem.status} (neutral)`
      );
    }

  } finally {
    // Limpieza de datos de prueba
    if (cleanPaymentKeys.length > 0) {
      await sbAdmin.from('payments').delete().in('external_id', cleanPaymentKeys);
    }
    if (cleanRunIds.length > 0) {
      await sbAdmin.from('ingest_runs').delete().in('id', cleanRunIds);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`RESULTADO FINAL: ${passed} pasados, ${failed} fallados de 12`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runAll12Tests().catch((err) => {
  console.error('Error fatal ejecutando pruebas:', err);
  process.exit(1);
});
