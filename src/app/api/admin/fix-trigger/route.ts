import { NextResponse } from 'next/server';

// ONE-TIME FIX ROUTE — delete after use
// Applies: fix trigger + create posts table
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (secret !== 'landaburo-fix-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Env vars missing', supabaseUrl: !!supabaseUrl, serviceKey: !!serviceKey });
  }

  return NextResponse.json({
    ok: true,
    supabaseUrl,
    serviceKeyLen: serviceKey.length,
    message: 'Env vars OK. Use Supabase SQL Editor to run the trigger fix.',
  });
}
