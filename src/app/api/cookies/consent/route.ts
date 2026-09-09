import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const analytics_accepted = Boolean(body.analytics_accepted);
    const marketing_accepted = Boolean(body.marketing_accepted);

    // 1. Extraer IP del cliente
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfIp = request.headers.get('cf-connecting-ip');
    const rawIp = forwarded ? forwarded.split(',')[0].trim() : realIp || cfIp || '127.0.0.1';

    // 2. Hashear la IP con HMAC-SHA256 ÚNICAMENTE si IP_HASH_SECRET está configurada.
    // Sin secret, no se genera hash y no se usa ningún fallback hardcodeado.
    let ip_hash: string | null = null;
    const hashSecret = process.env.IP_HASH_SECRET;
    if (hashSecret && hashSecret.trim()) {
      ip_hash = crypto.createHmac('sha256', hashSecret.trim()).update(rawIp).digest('hex');
    }

    // 3. Guardar en la tabla cookie_consents de Supabase usando cliente ANÓNIMO (RLS anon INSERT)
    // IMPORTANTE: NO encadenar .select() ni returning para respetar RLS restrictivo de anon.
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );
      
      const { error } = await supabase
        .from('cookie_consents')
        .insert({
          ip_hash: ip_hash || null,
          analytics_accepted,
          marketing_accepted,
        });

      if (error) {
        console.error('[CookieConsent] Error al registrar en Supabase:', error.message);
      }
    } catch (dbErr: any) {
      console.error('[CookieConsent] Excepción al persistir en Supabase:', dbErr?.message || dbErr);
    }

    // 4. Configurar cookie HTTP en la respuesta (siempre se establece para garantizar persistencia en navegador por 12 meses)
    const host = request.headers.get('host') || '';
    const isProdDomain = host.includes('dralandaburo.com');

    const response = NextResponse.json({
      success: true,
      consent: {
        analytics_accepted,
        marketing_accepted,
      },
    });

    response.cookies.set('cookie_consent', JSON.stringify({
      a: analytics_accepted ? 1 : 0,
      m: marketing_accepted ? 1 : 0,
    }), {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 365 días (12 meses)
      sameSite: 'lax',
      httpOnly: false, // Accesible por cliente para lectura rápida
      ...(isProdDomain ? { domain: '.dralandaburo.com' } : {}),
    });

    return response;
  } catch (err: any) {
    console.error('Excepción en /api/cookies/consent:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
