import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, message, treatment } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Por favor completá los campos obligatorios (Nombre, Email y Mensaje).' },
        { status: 400 }
      );
    }

    // 1. Guardar en Supabase si la tabla leads existe
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { cookies: { getAll: () => [], setAll: () => {} } }
      );

      await supabase.from('leads').insert([
        {
          full_name: name,
          email,
          phone: phone || null,
          notes: [Contacto Web] Tratamiento: \nMensaje: ,
          status: 'nuevo',
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (dbErr) {
      console.warn('[Contacto] No se pudo guardar en Supabase:', dbErr);
    }

    // 2. Logging estructurado para dralandaburo@gmail.com
    console.log('[Contacto Web -> dralandaburo@gmail.com]', {
      destinatario: 'dralandaburo@gmail.com',
      remitente: ${name} <>,
      telefono: phone || 'No especificado',
      tratamiento: treatment || 'Consulta general',
      mensaje,
      fecha: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
    });

    return NextResponse.json({
      success: true,
      message: '¡Gracias por contactarte! Tu mensaje ha sido enviado a dralandaburo@gmail.com y nos comunicaremos con vos a la brevedad.',
    });
  } catch (error) {
    console.error('[Contacto API Error]:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al procesar tu solicitud. Por favor intentá nuevamente o contactanos por WhatsApp.' },
      { status: 500 }
    );
  }
}
