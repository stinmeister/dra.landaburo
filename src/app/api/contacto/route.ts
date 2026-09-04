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
          notes: `[Contacto Web] Tratamiento: ${treatment || 'General'}\nMensaje: ${message}`,
          status: 'nuevo',
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (dbErr) {
      console.warn('[Contacto] No se pudo guardar en Supabase:', dbErr);
    }

    // 2. Despacho de Email con Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const emailHtml = `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background: #1C1C1C; padding: 24px; text-align: center;">
              <h1 style="color: #C5A47E; margin: 0; font-size: 20px; font-weight: 500; letter-spacing: 0.05em;">Dra. Landaburo — Nueva Consulta Web</h1>
            </div>
            <div style="padding: 24px 28px; color: #333333; line-height: 1.6;">
              <p style="font-size: 15px; margin-top: 0;">Has recibido un nuevo mensaje desde el formulario de contacto de la web:</p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 10px 0; font-weight: bold; width: 140px; color: #666;">Nombre:</td>
                  <td style="padding: 10px 0; color: #111;">${name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 10px 0; font-weight: bold; color: #666;">Email:</td>
                  <td style="padding: 10px 0; color: #111;"><a href="mailto:${email}" style="color: #C5A47E; text-decoration: none;">${email}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 10px 0; font-weight: bold; color: #666;">Teléfono / WA:</td>
                  <td style="padding: 10px 0; color: #111;">${phone ? `<a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" style="color: #C5A47E; text-decoration: none;">${phone}</a>` : 'No especificado'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 10px 0; font-weight: bold; color: #666;">Tratamiento:</td>
                  <td style="padding: 10px 0; color: #111;">${treatment || 'Consulta general'}</td>
                </tr>
              </table>

              <div style="background: #f9f9f9; border-left: 3px solid #C5A47E; padding: 14px 18px; border-radius: 4px; margin-top: 15px;">
                <p style="margin: 0; font-size: 14px; color: #444; white-space: pre-wrap;"><strong>Mensaje del paciente:</strong><br />${message}</p>
              </div>

              <p style="font-size: 12px; color: #999999; margin-top: 25px; text-align: center;">
                Recibido el ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} hs desde dralandaburo.com
              </p>
            </div>
          </div>
        `;

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Consultorio Dra. Landaburo <consultas@dralandaburo.com>',
            to: ['dra.landaburo@gmail.com', 'Paula@dralandaburo.com'],
            reply_to: email,
            subject: `[Web Consulta] ${name} — ${treatment || 'Consulta General'}`,
            html: emailHtml,
          }),
        });

        if (!resendRes.ok) {
          const resendErr = await resendRes.text();
          console.error('[Contacto/Resend Error]:', resendRes.status, resendErr);
        } else {
          console.log('[Contacto/Resend] Email entregado con éxito para:', email);
        }
      } catch (emailErr) {
        console.error('[Contacto/Resend Network Error]:', emailErr);
      }
    } else {
      console.warn('[Contacto] RESEND_API_KEY no configurado en entorno. Se registró lead pero no se despachó email.');
    }

    return NextResponse.json({
      success: true,
      message: '¡Gracias por contactarte! Tu mensaje ha sido enviado y nos comunicaremos con vos a la brevedad.',
    });
  } catch (error) {
    console.error('[Contacto API Error]:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al procesar tu solicitud. Por favor intentá nuevamente o contactanos por WhatsApp.' },
      { status: 500 }
    );
  }
}
