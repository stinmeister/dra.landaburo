import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      full_name,
      dni,
      email,
      phone,
      birth_date,
      city = 'Gualeguaychú',
      attribution_channel,
      referral_name,
      interests = [],
      medical_notes,
    } = body;

    if (!full_name || !email || !phone || !attribution_channel) {
      return NextResponse.json(
        { success: false, message: 'Faltan campos obligatorios' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('kiosk_admissions')
      .upsert(
        {
          full_name,
          dni: dni || null,
          email: email.toLowerCase().trim(),
          phone,
          birth_date: birth_date || null,
          city,
          attribution_channel,
          referral_name: referral_name || null,
          interests,
          medical_notes: medical_notes || null,
          device_info: { platform: 'ipad_kiosk', user_agent: req.headers.get('user-agent') },
          status: 'nuevo',
        },
        {
          onConflict: 'email',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .single();

    if (error) {
      console.error('Kiosk admission error:', error);
      return NextResponse.json(
        { success: false, message: 'Error al guardar la admisión' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Admisión registrada correctamente.',
      patient_id: data?.id,
    });
  } catch (err) {
    console.error('Kiosk route error:', err);
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
