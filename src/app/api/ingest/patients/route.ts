import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { persistReviewItems } from '@/lib/ingest-review';

// ---------------------------------------------------------------------------
// Supabase admin client (bypasses RLS)
// ---------------------------------------------------------------------------
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PatientInput {
  DNI?: string;
  Apellido?: string;
  Nombre?: string;
  WhatsApp_E164?: string;
  Fecha_Nacimiento?: string;
  Email?: string;
  OS_Prepaga?: string;
  Fuente_Datos?: string;
  Segmento_RFM?: string;
  rfm_segment?: string;
  RFM?: string;
  segmento_rfm?: string;
  [key: string]: unknown;
}

interface ReviewDetail {
  index: number;
  reason: string;
  record: PatientInput;
}

interface RejectedDetail {
  index: number;
  reason: string;
  record: PatientInput;
}

// ---------------------------------------------------------------------------
// Helpers & RFM Mapping
// ---------------------------------------------------------------------------

// Valores exactos permitidos por el constraint patients_rfm_segment_check en DB:
// 'Nuevo', 'En Riesgo', 'No Perder', 'Inactivo', 'Durmiente 2025', 'Inactivo pre-2025'
const RFM_MAP: Record<string, string> = {
  nuevo: 'Nuevo',
  nuevos: 'Nuevo',
  'en riesgo': 'En Riesgo',
  en_riesgo: 'En Riesgo',
  'no perder': 'No Perder',
  no_perder: 'No Perder',
  inactivo: 'Inactivo',
  inactivos: 'Inactivo',
  durmiente: 'Durmiente 2025',
  durmientes: 'Durmiente 2025',
  'durmiente 2025': 'Durmiente 2025',
  'inactivo pre-2025': 'Inactivo pre-2025',
  'inactivo pre 2025': 'Inactivo pre-2025',
  activo: 'Nuevo',
  activos: 'Nuevo',
};

function normalizeRfmSegment(raw: unknown): { mapped: string | null; note?: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { mapped: null };
  const clean = raw.trim().toLowerCase();
  const matched = RFM_MAP[clean];
  if (matched) {
    const note =
      clean === 'activo' || clean === 'activos' || clean === 'durmiente' || clean === 'durmientes'
        ? `rfm_mapeado: '${raw.trim()}' -> '${matched}'`
        : undefined;
    return { mapped: matched, note };
  }
  return {
    mapped: 'Nuevo',
    note: `rfm_desconocido: '${raw.trim()}' no reconocido en constraint, asignado 'Nuevo'`,
  };
}

/** Normalise a DNI string: strip dots and spaces. */
function normalizeDni(raw: string): string {
  return raw.trim().replace(/[.\s]/g, '');
}

/**
 * Returns true if the value looks like a hash (contains any letter),
 * meaning it is NOT a real DNI number.
 * Real Argentine DNIs are 7-8 digits only.
 */
function isHash(value: string): boolean {
  return /[a-zA-Z]/.test(value);
}

/**
 * Parse a date string in DD-MM-YYYY format.
 * Returns an ISO date string 'YYYY-MM-DD' or null on failure.
 */
function parseDDMMYYYY(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  const parts = raw.trim().split('-');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return iso;
}

/**
 * Build the notes string from OS_Prepaga and Fuente_Datos.
 */
function buildNotes(os: string | undefined, fuente: string | undefined): string | null {
  const parts: string[] = [];
  if (os?.trim()) parts.push(`OS: ${os.trim()}`);
  if (fuente?.trim()) parts.push(`Fuente: ${fuente.trim()}`);
  return parts.length > 0 ? parts.join(' | ') : null;
}

/**
 * Merge notes: if DB already has notes, update or append without accumulating duplicates.
 * E.g., OS: OSDE 310 replaces OS: OSDE, not appends it.
 */
function mergeNotes(existing: string | null, incoming: string | null): string | null {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const existingParts = existing.split(' | ').map((p) => p.trim()).filter(Boolean);
  const incomingParts = incoming.split(' | ').map((p) => p.trim()).filter(Boolean);

  const partMap = new Map<string, string>();
  for (const part of existingParts) {
    const key = part.split(':')[0]?.trim() || part;
    partMap.set(key, part);
  }
  for (const part of incomingParts) {
    const key = part.split(':')[0]?.trim() || part;
    partMap.set(key, part);
  }

  return Array.from(partMap.values()).join(' | ');
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // -- Auth ------------------------------------------------------------------
  const ingestSecret = process.env.INGEST_SECRET;
  if (!ingestSecret) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${ingestSecret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // -- Parse body ------------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON array' }, { status: 400 });
  }

  const records = body as PatientInput[];

  // -- Counters --------------------------------------------------------------
  let inserted = 0;
  let updated = 0;
  let skippedNoChange = 0;
  const needsReviewDetail: ReviewDetail[] = [];
  const rejectedDetail: RejectedDetail[] = [];

  // -- Process each record ---------------------------------------------------
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // Validate required fields
    const apellido = rec.Apellido?.trim() ?? '';
    const nombre = rec.Nombre?.trim() ?? '';

    if (!apellido && !nombre) {
      rejectedDetail.push({ index: i, reason: 'Missing both Apellido and Nombre', record: rec });
      continue;
    }

    // Formato amigable para hablarle a la paciente: Nombre Apellido
    const fullName = [nombre, apellido].filter(Boolean).join(' ').trim();
    const phone = rec.WhatsApp_E164?.trim() || null;
    const email = rec.Email?.trim() || null;
    const osNotes = buildNotes(rec.OS_Prepaga, rec.Fuente_Datos);

    // -- Parse & normalize RFM segment ---------------------------------------
    const rawRfm = rec.Segmento_RFM ?? rec.rfm_segment ?? rec.RFM ?? rec.segmento_rfm;
    const { mapped: mappedRfm, note: rfmNote } = normalizeRfmSegment(rawRfm);
    const reviewReasons: string[] = [];
    if (rfmNote) {
      reviewReasons.push(rfmNote);
    }

    // -- Parse birthdate -----------------------------------------------------
    let birthdate: string | null = null;
    let birthdateInvalid = false;
    if (rec.Fecha_Nacimiento?.trim()) {
      birthdate = parseDDMMYYYY(rec.Fecha_Nacimiento);
      if (birthdate === null) {
        birthdateInvalid = true;
        // Don't reject — insert with null and flag needs_review
      }
    }

    // -- DNI normalisation ---------------------------------------------------
    const rawDni = rec.DNI?.trim() ?? '';
    let normalizedDni: string | null = null;
    let lookupByPhone = false;
    let hashDni = false;

    if (!rawDni) {
      lookupByPhone = true;
    } else {
      const norm = normalizeDni(rawDni);
      if (isHash(norm)) {
        hashDni = true;
        lookupByPhone = true;
      } else {
        normalizedDni = norm;
      }
    }

    // -- Find existing patient -----------------------------------------------
    let existingRow: Record<string, unknown> | null = null;

    if (normalizedDni) {
      // Primary lookup: by DNI
      const { data, error } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('dni', normalizedDni)
        .maybeSingle();

      if (error) {
        rejectedDetail.push({ index: i, reason: `DB lookup error: ${error.message}`, record: rec });
        continue;
      }
      existingRow = data ?? null;
    } else if (lookupByPhone && phone) {
      // Secondary lookup: by phone
      const { data, error } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('phone', phone);

      if (error) {
        rejectedDetail.push({ index: i, reason: `DB phone lookup error: ${error.message}`, record: rec });
        continue;
      }

      if (data && data.length === 1) {
        existingRow = data[0];
        reviewReasons.push(`vinculo_por_telefono: registro vinculado por teléfono (${phone}) al carecer de DNI unívoco`);
      } else if (data && data.length > 1) {
        // Multiples pacientes comparten el mismo teléfono (madre/hijo, hermanos, etc.)
        // NO elegir arbitrariamente data[0] para evitar sobreescritura destructiva.
        needsReviewDetail.push({
          index: i,
          reason: `ambiguous_phone_match: ${data.length} pacientes en la base comparten el teléfono ${phone} — registro no modificado para evitar sobreescritura arbitraria`,
          record: rec,
        });
        continue;
      }
    }

    const now = new Date().toISOString();

    // -- Build review flags --------------------------------------------------
    if (birthdateInvalid) {
      reviewReasons.push(`Fecha_Nacimiento invalida: '${rec.Fecha_Nacimiento}'`);
    }
    if (hashDni && !existingRow) {
      reviewReasons.push(`DNI hash '${rawDni}' no matcheo por phone`);
    }

    // -- UPSERT --------------------------------------------------------------
    if (existingRow) {
      // UPDATE -- only fill empty fields
      const dbRow = existingRow as {
        id: string;
        full_name: string | null;
        phone: string | null;
        email: string | null;
        birthdate: string | null;
        notes: string | null;
        dni: string | null;
        rfm_segment: string | null;
        synced_at: string | null;
      };

      const changes: Record<string, unknown> = {};

      if (!dbRow.full_name?.trim() && fullName) {
        changes['full_name'] = fullName;
      }
      if (!dbRow.phone && phone) {
        changes['phone'] = phone;
      }
      if (!dbRow.email && email) {
        changes['email'] = email;
      }
      if (!dbRow.birthdate && birthdate) {
        changes['birthdate'] = birthdate;
      }
      if (!dbRow.rfm_segment && mappedRfm) {
        changes['rfm_segment'] = mappedRfm;
      }
      // If matched via phone and DB has no DNI, backfill it
      if (!dbRow.dni && normalizedDni) {
        changes['dni'] = normalizedDni;
      }
      // Always merge trazabilidad notes
      const mergedNotes = mergeNotes(dbRow.notes, osNotes);
      if (mergedNotes !== dbRow.notes) {
        changes['notes'] = mergedNotes;
      }
      // Always refresh synced_at
      changes['synced_at'] = now;

      const onlySynced =
        Object.keys(changes).length === 1 && 'synced_at' in changes;

      const { error: updateError } = await supabaseAdmin
        .from('patients')
        .update(changes)
        .eq('id', dbRow.id);

      if (updateError) {
        rejectedDetail.push({
          index: i,
          reason: `Update failed: ${updateError.message}`,
          record: rec,
        });
        continue;
      }

      if (onlySynced) {
        skippedNoChange++;
      } else {
        updated++;
      }
    } else {
      // INSERT
      // patients.phone is NOT NULL in DB — skip insert if phone is missing
      if (!phone) {
        needsReviewDetail.push({
          index: i,
          reason: 'sin_telefono: WhatsApp_E164 vacio y patients.phone es NOT NULL — registro no insertado',
          record: rec,
        });
        continue;
      }

      const insertPayload: Record<string, unknown> = {
        full_name: fullName,
        phone,
        email,
        birthdate,
        notes: osNotes,
        synced_at: now,
      };

      if (mappedRfm) {
        insertPayload['rfm_segment'] = mappedRfm;
      }

      if (normalizedDni) {
        insertPayload['dni'] = normalizedDni;
      } else if (hashDni) {
        // Store hash as-is; if DB rejects it (UNIQUE or NOT NULL constraint), error surfaces below
        insertPayload['dni'] = rawDni;
        reviewReasons.push(`DNI es un hash, insertado como-es: '${rawDni}'`);
      }
      // else: dni omitted (null) — will fail if column is NOT NULL

      const { error: insertError } = await supabaseAdmin
        .from('patients')
        .insert(insertPayload);

      if (insertError) {
        // Likely a NOT NULL or UNIQUE constraint on dni or another column
        rejectedDetail.push({
          index: i,
          reason: `Insert failed: ${insertError.message}`,
          record: rec,
        });
        continue;
      }
      inserted++;
    }

    // Flag needs_review after successful DB operation
    if (reviewReasons.length > 0) {
      needsReviewDetail.push({
        index: i,
        reason: reviewReasons.join('; '),
        record: rec,
      });
    }
  }

  // -- Persist review items to DB (idempotente) ------------------------------
  if (needsReviewDetail.length > 0) {
    await persistReviewItems(
      needsReviewDetail.map((item) => ({
        source: 'patients',
        record_identifier: item.record.DNI ? normalizeDni(item.record.DNI) : item.record.WhatsApp_E164 ?? null,
        reason: item.reason,
        payload: item.record as Record<string, unknown>,
      }))
    );
  }

  // -- Response --------------------------------------------------------------
  return NextResponse.json({
    success: true,
    summary: {
      total_received: records.length,
      inserted,
      updated,
      skipped_no_change: skippedNoChange,
      needs_review: needsReviewDetail.length,
      rejected: rejectedDetail.length,
    },
    needs_review_detail: needsReviewDetail,
    rejected_detail: rejectedDetail,
  });
}
