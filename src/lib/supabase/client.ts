// Browser client — safe to use in Client Components ('use client').
// Creates a new Supabase client tied to the browser's cookie store.
// Called once per render cycle; @supabase/ssr handles cookie synchronization
// so the auth session survives page refreshes without extra work.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
