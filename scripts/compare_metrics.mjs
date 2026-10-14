import { createClient } from '@supabase/supabase-js';

const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isProductSale(notes, patientName) {
  const n = (notes || '').toLowerCase();
  const p = (patientName || '').toLowerCase();
  return (
    n.includes('venta de producto') ||
    n.includes('venta de productos') ||
    n.includes('[venta-producto]') ||
    n.includes('[venta-mostrador]') ||
    p.includes('urdi') ||
    p.includes('productos')
  );
}

async function run() {
  console.log('=== COMPARACIÓN CONTABLE: EJECUTIVO PAGE VS RPC ===\n');

  const monthStart = '2026-09-01T00:00:00-03:00';
  const monthEnd = '2026-09-30T23:59:59.999-03:00';

  // 1. Cálculo actual de src/app/dashboard/ejecutivo/page.tsx
  const { data: monthTotalsRaw } = await sbAdmin
    .from('payments')
    .select('id, amount_ars, amount_usd, currency, commission_amount_ars, notes, professional_profile_id, patients ( full_name )')
    .is('superseded_by', null)
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd);

  const monthRows = monthTotalsRaw || [];
  const paidRows = monthRows.filter((p) => Number(p.amount_ars) > 0 || Number(p.amount_usd ?? 0) > 0);
  const zeroRows = monthRows.filter((p) => Number(p.amount_ars) === 0 && Number(p.amount_usd ?? 0) === 0);

  const productRows = paidRows.filter((p) => isProductSale(p.notes, p.patients?.full_name));
  const treatmentRows = paidRows.filter((p) => !isProductSale(p.notes, p.patients?.full_name));

  const pageTreatmentsARS = treatmentRows.reduce((sum, p) => sum + Number(p.amount_ars || 0), 0);
  const pageProductsARS = productRows.reduce((sum, p) => sum + Number(p.amount_ars || 0), 0);
  const pageTotalARS = pageTreatmentsARS + pageProductsARS;

  const pageUsdRows = monthRows.filter(
    (p) => p.currency === 'USD' || (p.amount_usd != null && Number(p.amount_usd) > 0)
  );
  const pageTotalUSD = pageUsdRows.reduce((sum, p) => sum + Number(p.amount_usd ?? 0), 0);

  console.log('Totales calculados por el Dashboard Ejecutivo actual (page.tsx):');
  console.log(' - Total ARS:', pageTotalARS);
  console.log('   · Tratamientos ARS:', pageTreatmentsARS);
  console.log('   · Productos ARS:', pageProductsARS);
  console.log(' - Total USD:', pageTotalUSD);
  console.log(' - Cantidad de cobros del mes:', monthRows.length);
  console.log(' - Cantidad de cobros con monto > 0:', paidRows.length);

  // 2. Consulta a la RPC obtener_metricas_ejecutivas autenticado como Admin
  const { data: profiles } = await sbAdmin.from('profiles').select('id, role').eq('role', 'admin').limit(1);
  const adminId = profiles[0].id;
  const { data: userAuth } = await sbAdmin.auth.admin.getUserById(adminId);
  const { data: linkData } = await sbAdmin.auth.admin.generateLink({ type: 'magiclink', email: userAuth.user.email });
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await client.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: 'magiclink' });

  const { data: rpcRes, error: rpcErr } = await client.rpc('obtener_metricas_ejecutivas', {
    p_start_date: monthStart,
    p_end_date: monthEnd,
  });

  console.log('\nTotales devueltos por la RPC obtener_metricas_ejecutivas:');
  console.log(' - total_ars:', rpcRes?.total_ars);
  console.log(' - total_usd:', rpcRes?.total_usd);
  console.log(' - total_count:', rpcRes?.total_count);
  console.log(' - by_method:', rpcRes?.by_method);

  console.log('\n--- VEREDICTO DE COINCIDENCIA CONTABLE ---');
  console.log('Total ARS coincide:', pageTotalARS === Number(rpcRes?.total_ars) ? 'SÍ ✅' : `DIFERENCIA: Page=${pageTotalARS} vs RPC=${rpcRes?.total_ars}`);
  console.log('Total USD coincide:', pageTotalUSD === Number(rpcRes?.total_usd) ? 'SÍ ✅' : `DIFERENCIA: Page=${pageTotalUSD} vs RPC=${rpcRes?.total_usd}`);
  console.log('Total Cobros coincide:', monthRows.length === rpcRes?.total_count ? 'SÍ ✅' : `DIFERENCIA: Page=${monthRows.length} vs RPC=${rpcRes?.total_count}`);
}

run().catch(console.error);
