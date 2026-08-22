// Centralized admin Supabase client for Server Actions and Server Components.
// Uses SUPABASE_SERVICE_ROLE_KEY — never exposed to the browser.
// Throws a descriptive error if the env var is missing so failures are obvious
// at startup rather than surfacing as cryptic runtime errors.
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[admin.ts] Missing Supabase env vars. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set ' +
      'in .env.local (development) or in the PM2 ecosystem / system environment (production).'
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
