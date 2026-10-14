import { createClient } from '@supabase/supabase-js';

const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const payload = {
    full_name: 'QA Test Anon No Select',
    email: 'qa.test.anon@dralandaburo.local',
    phone: '12345678',
    notes: '[TEST RETURNING HYPOTHESIS]',
    status: 'nuevo'
  };

  console.log('1. Testing insert WITHOUT .select():');
  const resNoSelect = await anon.from('leads').insert([payload]);
  console.log('resNoSelect error:', resNoSelect.error ? resNoSelect.error : 'SUCCESS! (No error) ✅');

  // Verify in DB with admin
  const { data: rows } = await admin
    .from('leads')
    .select('id, full_name, email, status, created_at')
    .eq('email', 'qa.test.anon@dralandaburo.local');
  console.log('2. Admin found rows in DB:', rows);

  // Clean up
  if (rows && rows.length > 0) {
    await admin.from('leads').delete().eq('email', 'qa.test.anon@dralandaburo.local');
    console.log('3. Cleaned up test row ✅');
  }
}

test().catch(console.error);
