import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    // 3. Guardar en la tabla cookie_consents de Supabase
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('cookie_consents')
      .insert({
        ip_hash,
        analytics_accepted,
        marketing_accepted,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Error insertando en cookie_consents:', error);
      // Retornamos 200 para no romper la UX del paciente si hay un problema temporal con Supabase
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 200 });
    }

    // 4. Configurar cookie HTTP en la respuesta
    const response = NextResponse.json({
      success: true,
      id: data?.id,
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
      maxAge: 365 * 24 * 60 * 60, // 1 año
      sameSite: 'lax',
      httpOnly: false, // Accesible por cliente para lectura rápida
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
