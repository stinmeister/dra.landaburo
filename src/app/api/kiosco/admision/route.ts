import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory sliding window rate limiter (max 10 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Cleanup stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref?.();

const ALLOWED_CHANNELS = [
  'instagram_organic',
  'instagram_ad',
  'google',
  'referral',
  'walk_in',
  'other',
];

const ALLOWED_KEYS = new Set([
  'full_name',
  'dni',
  'email',
  'phone',
  'birth_date',
  'city',
  'attribution_channel',
  'referral_name',
  'interests',
  'medical_notes',
]);

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[\d\s()+-]{6,30}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting by IP
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : realIp || '127.0.0.1';

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { success: false, message: 'Demasiadas solicitudes. Por favor intente más tarde.' },
        { status: 429 }
      );
    }

    // 2. Parse & strict schema validation
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Formato JSON inválido' },
        { status: 400 }
      );
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: 'Cuerpo de solicitud inválido' },
        { status: 400 }
      );
    }

    // Reject unknown/unexpected keys in payload
    for (const key of Object.keys(body)) {
      if (!ALLOWED_KEYS.has(key)) {
        return NextResponse.json(
          { success: false, message: `Campo no permitido en la solicitud: ${key}` },
          { status: 400 }
        );
      }
    }

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

    // Required fields check
    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2 || full_name.trim().length > 100) {
      return NextResponse.json(
        { success: false, message: 'Nombre completo inválido (2-100 caracteres requeridos)' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || email.trim().length > 150 || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { success: false, message: 'Formato de correo electrónico inválido' },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim())) {
      return NextResponse.json(
        { success: false, message: 'Número de teléfono inválido (debe contener entre 6 y 30 caracteres válidos)' },
        { status: 400 }
      );
    }

    if (!attribution_channel || typeof attribution_channel !== 'string' || !ALLOWED_CHANNELS.includes(attribution_channel)) {
      return NextResponse.json(
        { success: false, message: 'Canal de atribución inválido' },
        { status: 400 }
      );
    }

    // Optional fields validation
    if (dni !== undefined && dni !== null && (typeof dni !== 'string' || dni.trim().length > 20)) {
      return NextResponse.json(
        { success: false, message: 'DNI inválido (máximo 20 caracteres)' },
        { status: 400 }
      );
    }

    if (birth_date !== undefined && birth_date !== null && birth_date !== '' && (typeof birth_date !== 'string' || !DATE_REGEX.test(birth_date))) {
      return NextResponse.json(
        { success: false, message: 'Fecha de nacimiento inválida (formato esperado AAAA-MM-DD)' },
        { status: 400 }
      );
    }

    if (city !== undefined && city !== null && (typeof city !== 'string' || city.length > 100)) {
      return NextResponse.json(
        { success: false, message: 'Ciudad inválida (máximo 100 caracteres)' },
        { status: 400 }
      );
    }

    if (referral_name !== undefined && referral_name !== null && (typeof referral_name !== 'string' || referral_name.length > 100)) {
      return NextResponse.json(
        { success: false, message: 'Nombre de recomendación inválido (máximo 100 caracteres)' },
        { status: 400 }
      );
    }

    if (!Array.isArray(interests) || interests.length > 20 || interests.some((i) => typeof i !== 'string' || i.length > 50)) {
      return NextResponse.json(
        { success: false, message: 'Lista de intereses inválida' },
        { status: 400 }
      );
    }

    if (medical_notes !== undefined && medical_notes !== null && (typeof medical_notes !== 'string' || medical_notes.length > 1000)) {
      return NextResponse.json(
        { success: false, message: 'Notas médicas exceden el límite permitido (máximo 1000 caracteres)' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Prevent overwrites of existing admissions or patients
    // Check if admission already exists for this email or DNI
    const cleanDni = dni && typeof dni === 'string' ? dni.trim() : null;
    let existingAdmissionQuery = supabase
      .from('kiosk_admissions')
      .select('id, device_info');

    if (cleanDni) {
      existingAdmissionQuery = existingAdmissionQuery.or(`email.eq.${normalizedEmail},dni.eq.${cleanDni}`);
    } else {
      existingAdmissionQuery = existingAdmissionQuery.eq('email', normalizedEmail);
    }

    const { data: existingAdmissions } = await existingAdmissionQuery.limit(1);
    const existingAdmission = existingAdmissions && existingAdmissions.length > 0 ? existingAdmissions[0] : null;

    if (existingAdmission) {
      // Existing patient/admission check-in: DO NOT OVERWRITE existing record data!
      // Registrar la re-entrada en device_info como métrica de uso
      const currentDevInfo = (existingAdmission.device_info as Record<string, unknown>) || {};
      const prevCount = typeof currentDevInfo.reentry_count === 'number' ? currentDevInfo.reentry_count : 0;
      await supabase
        .from('kiosk_admissions')
        .update({
          device_info: {
            ...currentDevInfo,
            reentry_count: prevCount + 1,
            last_reentry_at: new Date().toISOString(),
          },
        })
        .eq('id', existingAdmission.id);

      return NextResponse.json({
        success: true,
        already_registered: true,
        message: 'Tu información ya se encuentra registrada en el sistema. Por favor pasá a recepción.',
      });
    }

    // 4. Insert new admission
    const { error: insertError } = await supabase
      .from('kiosk_admissions')
      .insert({
        full_name: full_name.trim(),
        dni: cleanDni,
        email: normalizedEmail,
        phone: phone.trim(),
        birth_date: birth_date ? birth_date : null,
        city: typeof city === 'string' ? city.trim() : 'Gualeguaychú',
        attribution_channel,
        referral_name: referral_name ? referral_name.trim() : null,
        interests,
        medical_notes: medical_notes ? medical_notes.trim() : null,
        device_info: {
          platform: 'ipad_kiosk',
          user_agent: req.headers.get('user-agent'),
          reentry_count: 0,
        },
        status: 'nuevo',
      });

    if (insertError) {
      console.error('Kiosk admission insert error:', insertError);
      return NextResponse.json(
        { success: false, message: 'Error al registrar la admisión' },
        { status: 500 }
      );
    }

    // 5. Secure response: no patient_id or PII returned
    return NextResponse.json({
      success: true,
      message: 'Admisión registrada correctamente.',
    });
  } catch (err) {
    console.error('Kiosk route unhandled error:', err);
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

