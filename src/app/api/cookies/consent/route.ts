import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

    // 2. Hashear la IP con SHA-256 para preservar privacidad de pacientes
    const ip_hash = crypto.createHash('sha256').update(rawIp).digest('hex');

    // 3. Guardar en la tabla cookie_consents de Supabase usando admin client (evita violación RLS 42501)
    let consentRecordId: string | null = null;
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('cookie_consents')
        .insert({
          ip_hash,
          analytics_accepted,
          marketing_accepted,
        })
        .select('id, created_at')
        .single();

      if (error) {
        console.warn('[CookieConsent] Error al registrar en Supabase:', error.message);
      } else {
        consentRecordId = data?.id ?? null;
      }
    } catch (dbErr) {
      console.warn('[CookieConsent] Excepción al persistir en Supabase:', dbErr);
    }

    // 4. Configurar cookie HTTP en la respuesta (siempre se establece para garantizar persistencia por 12 meses)
    const host = request.headers.get('host') || '';
    const isProdDomain = host.includes('dralandaburo.com');

    const response = NextResponse.json({
      success: true,
      id: consentRecordId,
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
