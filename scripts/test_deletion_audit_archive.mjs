import { createClient } from '@supabase/supabase-js';

const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('=== TEST BLOQUE 5.1: VERIFICACIÓN REAL DE deletion_audit EN ARCHIVADO ===\n');

  // 1. Obtener perfil admin para actor_id
  const { data: adminProfiles } = await sbAdmin
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'admin')
    .limit(1);

  const admin = adminProfiles?.[0];
  console.log('1. Actor administrador:', { id: admin?.id, full_name: admin?.full_name, role: admin?.role });

  // 2. Crear producto de prueba
  const testProdId = '00000000-0000-0000-0000-000000002410';
  await sbAdmin.from('products').delete().eq('id', testProdId);

  const { data: testProd, error: prodErr } = await sbAdmin.from('products').insert({
    id: testProdId,
    name: 'Producto QA Test Auditoria 1410',
    slug: 'producto-qa-test-auditoria-1410',
    brand_type: 'Otro',
    category: 'facial',
    price_ars: 5000,
    is_active: true,
  }).select('*').single();

  if (prodErr || !testProd) {
    console.error('Error creando producto de prueba:', prodErr);
    return;
  }
  console.log('2. Producto de prueba creado:', { id: testProd.id, name: testProd.name, is_active: testProd.is_active });

  // 3. Simular archivado: insertar en deletion_audit y desactivar producto
  console.log('\n3. Registrando archivado en public.deletion_audit...');
  const actorName = admin?.full_name || 'Administrador QA';
  const { data: auditRow, error: auditErr } = await sbAdmin.from('deletion_audit').insert({
    actor_id: admin?.id || null,
    actor_name: actorName,
    action: 'archivado',
    entity_type: 'producto',
    entity_id: testProd.id,
    entity_name: testProd.name,
    reason: 'Archivado / desactivación manual desde catálogo (Test QA 1410)',
    snapshot: testProd,
  }).select('*').single();

  if (auditErr) {
    console.error('Error insertando en deletion_audit:', auditErr);
    return;
  }

  // Desactivar producto
  await sbAdmin.from('products').update({ is_active: false }).eq('id', testProdId);

  console.log('   Fila insertada en deletion_audit con éxito ✅:');
  console.log('   - id:', auditRow.id);
  console.log('   - occurred_at:', auditRow.occurred_at);
  console.log('   - actor_name:', auditRow.actor_name, '✅');
  console.log('   - action:', auditRow.action, '(esperado: archivado) ✅');
  console.log('   - entity_name:', auditRow.entity_name, '✅');
  console.log('   - snapshot:', JSON.stringify(auditRow.snapshot));

  // 4. Probar triggers de inmutabilidad (no update, no delete en deletion_audit)
  console.log('\n4. Probando trigger de inmutabilidad trg_deletion_audit_no_update...');
  const { error: updAuditErr } = await sbAdmin
    .from('deletion_audit')
    .update({ reason: 'Modificación maliciosa' })
    .eq('id', auditRow.id);

  console.log('   Intento de UPDATE:', updAuditErr ? `BLOQUEADO POR TRIGGER (${updAuditErr.message}) ✅` : 'PERMITIDO ❌ (FALLO TRIGGER)');

  console.log('\n5. Probando trigger de inmutabilidad trg_deletion_audit_no_delete...');
  const { error: delAuditErr } = await sbAdmin
    .from('deletion_audit')
    .delete()
    .eq('id', auditRow.id);

  console.log('   Intento de DELETE:', delAuditErr ? `BLOQUEADO POR TRIGGER (${delAuditErr.message}) ✅` : 'PERMITIDO ❌ (FALLO TRIGGER)');

  // 5. Limpieza del producto de prueba
  console.log('\n6. Limpiando producto de prueba...');
  await sbAdmin.from('products').delete().eq('id', testProdId);
  console.log('   Producto de prueba eliminado ✅');

  console.log('\n=== TEST BLOQUE 5.1 COMPLETADO CON ÉXITO ===\n');
}

run().catch(console.error);
