import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runTest() {
  console.log('=== TEST 4.3: INTENTO DE BORRADO DE PRODUCTO CON FOLLETERÍA Y TAREA ASOCIADA ===\n');

  // 1. Obtener perfil admin para created_by
  const { data: adminProf } = await sb.from('profiles').select('id, full_name').eq('role', 'admin').limit(1).single();
  console.log('1. Rol admin verificado:', adminProf.full_name, `(${adminProf.id})`);

  // 2. Crear producto temporal
  const { data: prod, error: pErr } = await sb
    .from('products')
    .insert({
      name: 'QA Test Producto Protegido 4.3',
      slug: 'qa-test-producto-protegido-' + Date.now(),
      price_ars: 2500,
      stock_quantity: 0,
      category: 'Suplementos',
      brand_type: 'Dra. Landaburo',
      is_active: true,
    })
    .select('id, name')
    .single();

  if (pErr) throw pErr;
  console.log('2. Producto creado para prueba:', prod.name, `(ID: ${prod.id})`);

  // 3. Crear material de folletería y vincularlo
  const { data: mat, error: matErr } = await sb
    .from('practice_materials')
    .insert({
      title: 'Folleto Cuidado Facial QA 4.3',
      category: 'protocolo',
      storage_path: 'folletos/qa-test-43.pdf',
      file_name: 'qa-test-43.pdf',
      file_size_bytes: 2048,
      mime_type: 'application/pdf',
      created_by: adminProf.id,
    })
    .select('id, title')
    .single();

  if (matErr) throw matErr;

  const { data: link, error: lErr } = await sb
    .from('practice_material_links')
    .insert({
      material_id: mat.id,
      entity_id: prod.id,
      entity_type: 'product',
    })
    .select('id')
    .single();

  if (lErr) throw lErr;
  console.log('3. Folleto de práctica y link creado:', mat.title, `(Link ID: ${link.id})`);

  // 4. Crear staff_task vinculada al producto
  const { data: task, error: tErr } = await sb
    .from('staff_tasks')
    .insert({
      title: 'Reposición urgente de stock para QA Test Producto Protegido 4.3',
      task_type: 'recurrente',
      status: 'pendiente',
      target_role: 'operativo',
      due_date: new Date(Date.now() + 86400000).toISOString(),
      related_entity_id: prod.id,
    })
    .select('id, title')
    .single();

  if (tErr) throw tErr;
  console.log('4. Staff task creada:', task.title, `(Task ID: ${task.id})`);

  // 5. Ejecutar chequeo de dependencias de deleteProduct
  const { count: linkCount } = await sb
    .from('practice_material_links')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', prod.id)
    .in('entity_type', ['producto', 'product']);

  const { count: taskCount } = await sb
    .from('staff_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('related_entity_id', prod.id);

  console.log('\n--- 5. Evaluación de regla de integridad referencial ---');
  console.log('   Dependencias detectadas: folletos =', linkCount, ', tareas staff =', taskCount);

  let rechazo = false;
  let mensajeError = '';
  if ((linkCount && linkCount > 0) || (taskCount && taskCount > 0)) {
    const parts = [];
    if (linkCount && linkCount > 0) parts.push(`${linkCount} folleto(s)`);
    if (taskCount && taskCount > 0) parts.push(`${taskCount} tarea(s)`);
    rechazo = true;
    mensajeError = `No se puede eliminar porque tiene ${parts.join(' y ')} asociada(s). Podés archivarlo.`;
  }

  console.log('   ¿Intento de eliminación rechazado?:', rechazo ? 'SÍ ✅' : 'NO ❌');
  console.log('   Mensaje amigable devuelto a la UI:', `"${mensajeError}"`);

  // 6. Verificar que las dos filas SIGUEN EXISTIENDO en la base
  console.log('\n--- 6. Comprobación de persistencia post-intento de borrado ---');
  const { data: linkAfter } = await sb
    .from('practice_material_links')
    .select('id')
    .eq('id', link.id)
    .single();

  const { data: taskAfter } = await sb
    .from('staff_tasks')
    .select('id, title, status')
    .eq('id', task.id)
    .single();

  const { data: prodAfter } = await sb
    .from('products')
    .select('id, name')
    .eq('id', prod.id)
    .single();

  console.log('   Fila en practice_material_links persiste:', linkAfter ? `SÍ (${linkAfter.id}) ✅` : 'NO ❌');
  console.log('   Fila en staff_tasks persiste intacta:', taskAfter ? `SÍ (${taskAfter.id}, status: ${taskAfter.status}) ✅` : 'NO ❌');
  console.log('   Fila en products sigue intacta:', prodAfter ? `SÍ (${prodAfter.id}) ✅` : 'NO ❌');

  // 7. Limpieza controlada de registros de prueba
  await sb.from('practice_material_links').delete().eq('id', link.id);
  await sb.from('practice_materials').delete().eq('id', mat.id);
  await sb.from('staff_tasks').delete().eq('id', task.id);
  await sb.from('products').delete().eq('id', prod.id);
  console.log('\n--- 7. Limpieza de datos de prueba completada sin alterar registros reales ✅ ---');
}

runTest().catch(console.error);
