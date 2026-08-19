// Middleware runs on every request matching the config.matcher pattern.
// Two responsibilities:
//   1. Refresh the Supabase session cookies so the server-side auth state
//      never goes stale (required by @supabase/ssr — do NOT replace getUser
//      with getSession; getUser validates with the Supabase server).
//   2. Guard /dashboard/* and /portal/* routes — redirect to /login if no
//      active session, or redirect away from /login|/registro if already
//      authenticated.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/portal'];
const AUTH_ONLY_PREFIXES = ['/login', '/registro'];

export async function middleware(request: NextRequest) {
  // Start with a plain next() response; the cookie setter will replace it
  // with a new NextResponse that carries the refreshed auth cookies.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror cookies onto the request so downstream middleware sees them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Rebuild the response so the updated cookies reach the browser
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() makes a lightweight round-trip to Supabase to validate the JWT
  // and refresh it when needed. Must happen before any redirect decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Authenticated users trying to access /login or /registro → send home
  if (user && AUTH_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Unauthenticated users trying to access protected routes → send to /login
  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images).*)'],
};
