import { createClient } from '@supabase/supabase-js';

const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('=== TEST 3: VERIFICACIÓN DEL GUARD DE ROL EN obtener_metricas_ejecutivas ===\n');

  // 1. Obtener perfiles de cada rol
  const { data: profiles, error: profErr } = await sbAdmin
    .from('profiles')
    .select('id, role')
    .in('role', ['admin', 'medico', 'operativo', 'paciente']);

  if (profErr || !profiles) {
    console.error('Error consultando perfiles:', profErr);
    return;
  }

  const adminProfile = profiles.find(p => p.role === 'admin');
  const medicoProfile = profiles.find(p => p.role === 'medico');
  const operativoProfile = profiles.find(p => p.role === 'operativo');
  const pacienteProfile = profiles.find(p => p.role === 'paciente');

  console.log('Perfiles detectados (identificados solo por rol e ID anonimizado):');
  console.log(' - Admin ID:', adminProfile?.id?.slice(0, 8) + '...');
  console.log(' - Medico ID:', medicoProfile?.id?.slice(0, 8) + '...');
  console.log(' - Operativo ID:', operativoProfile?.id?.slice(0, 8) + '...');
  console.log(' - Paciente ID:', pacienteProfile?.id?.slice(0, 8) + '...');

  // 2. Probar llamada sin token o anónima (debe fallar con 42501)
  console.log('\n--- 1. Llamada sin usuario autenticado / anónima ---');
  const sbAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data: anonRes, error: anonErr } = await sbAnon.rpc('obtener_metricas_ejecutivas', {
    p_start_date: '2026-09-01T00:00:00-03:00',
    p_end_date: '2026-09-30T23:59:59-03:00',
  });
  console.log('Resultado anónimo:', anonErr ? `RECHAZADO (${anonErr.message}, code ${anonErr.code}) ✅` : 'PERMITIDO ❌ (INSEGURO)');

  // 3. Probar llamando con JWT impersonado o evaluando la función
  // En Supabase, podemos generar una sesión con sbAdmin.auth.admin.generateLink o signInWithIdToken
  // o podemos usar un helper para crear un cliente autenticado como ese usuario.
  // Vamos a probar con admin.auth.admin.generateLink para un usuario operativo/paciente y admin
  
  async function testAsUser(userId, roleName) {
    console.log(`\n--- Probando RPC como rol "${roleName}" (ID ${userId?.slice(0, 8)}...) ---`);
    if (!userId) {
      console.log(`No se encontró perfil para rol ${roleName}`);
      return;
    }

    try {
      // Obtenemos los datos del usuario en auth
      const { data: userAuth } = await sbAdmin.auth.admin.getUserById(userId);
      if (!userAuth?.user?.email) {
        console.log(`Usuario no tiene email en auth.users`);
        return;
      }

      // Generar link de login para obtener token
      const { data: linkData, error: linkErr } = await sbAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: userAuth.user.email,
      });

      if (linkErr || !linkData?.properties?.action_link) {
        console.log(`No se pudo generar link para ${roleName}:`, linkErr?.message);
        return;
      }

      // Con el hashed_token podemos verificar la sesión
      const hashedToken = linkData.properties.hashed_token;
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { data: verifyData, error: verifyErr } = await client.auth.verifyOtp({
        token_hash: hashedToken,
        type: 'magiclink',
      });

      if (verifyErr || !verifyData?.session?.access_token) {
        console.log(`Error verificando token OTP para ${roleName}:`, verifyErr?.message);
        return;
      }

      // Llamar a la RPC con el cliente autenticado
      const { data: rpcData, error: rpcErr } = await client.rpc('obtener_metricas_ejecutivas', {
        p_start_date: '2026-09-01T00:00:00-03:00',
        p_end_date: '2026-09-30T23:59:59-03:00',
      });

      if (roleName === 'paciente' || roleName === 'operativo') {
        if (rpcErr && (rpcErr.code === '42501' || rpcErr.message.includes('No autorizado'))) {
          console.log(`[PASS] Rol ${roleName} RECHAZADO correctamente con 42501: "${rpcErr.message}" ✅`);
        } else {
          console.log(`[FAIL] Rol ${roleName} NO fue rechazado:`, rpcData || rpcErr);
        }
      } else if (roleName === 'admin' || roleName === 'medico') {
        if (!rpcErr && rpcData) {
          console.log(`[PASS] Rol ${roleName} AUTORIZADO correctamente:`, {
            total_ars: rpcData.total_ars,
            total_usd: rpcData.total_usd,
            total_count: rpcData.total_count,
            period_start: rpcData.period_start,
            period_end: rpcData.period_end,
          }, '✅');
        } else {
          console.log(`[FAIL] Rol ${roleName} falló con error:`, rpcErr);
        }
      }
    } catch (e) {
      console.error(`Excepción probando rol ${roleName}:`, e.message);
    }
  }

  if (pacienteProfile) await testAsUser(pacienteProfile.id, 'paciente');
  if (operativoProfile) await testAsUser(operativoProfile.id, 'operativo');
  if (adminProfile) await testAsUser(adminProfile.id, 'admin');
  if (medicoProfile) await testAsUser(medicoProfile.id, 'medico');

  console.log('\n=== TEST 3 COMPLETADO ===\n');
}

run().catch(console.error);
