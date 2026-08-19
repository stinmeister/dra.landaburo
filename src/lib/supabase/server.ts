// Server client — use in Server Components, Route Handlers, and Server Actions.
// Must be created fresh per request (not cached at module level) because it
// wraps Next.js cookies() which is request-scoped. The setAll catch block
// swallows errors from Server Components where cookies are read-only — that's
// expected behavior per @supabase/ssr docs.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components can't set cookies — middleware handles refresh
          }
        },
      },
    }
  );
}
