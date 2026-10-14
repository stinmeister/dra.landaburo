import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('=== TEST 2: VERIFICACIÓN DEL FORMULARIO DE CONTACTO ===\n');

  const testEmail = 'qa.test.contacto.1410@dralandaburo.local';
  const testPayload = {
    name: 'QA Verificación Contacto 1410',
    email: testEmail,
    phone: '+5493446001410',
    treatment: 'Consulta de Prueba Automatizada',
    message: '[TEST AUTOMATIZADO 1410] Verificación de inserción anónima de lead sin fallback',
  };

  // Asegurar limpieza previa
  await sb.from('leads').delete().eq('email', testEmail);

  console.log('1. Enviando formulario POST a https://dralandaburo.com/api/contacto...');
  const res = await fetch('https://dralandaburo.com/api/contacto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });

  const resJson = await res.json().catch(() => ({}));
  console.log(`   Respuesta HTTP: Status ${res.status}`, resJson);

  // 2. Verificar que el lead existe en la BD
  console.log('\n2. Consultando fila insertada en public.leads...');
  const { data: rows } = await sb
    .from('leads')
    .select('id, full_name, email, phone, status, notes, created_at')
    .eq('email', testEmail);

  console.log('   Filas encontradas en DB:', rows);
  const lead = rows?.[0];

  if (lead) {
    console.log('   Lead insertado con éxito ✅:');
    console.log('   - id:', lead.id);
    console.log('   - status:', lead.status, '(esperado: nuevo)');
    console.log('   - full_name:', lead.full_name);

    // 3. Limpieza inmediata
    console.log('\n3. Limpiando lead de prueba de la base de datos...');
    await sb.from('leads').delete().eq('id', lead.id);
    console.log('   Lead de prueba limpiado ✅');
  } else {
    console.error('   ❌ ERROR: No se encontró el lead en la base de datos.');
  }

  console.log('\n=== TEST 2 COMPLETADO ===\n');
}

run().catch(console.error);
