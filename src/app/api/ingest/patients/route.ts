import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
// Helpers
// ---------------------------------------------------------------------------

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
 * Merge notes: if DB already has notes, append new info not already present.
 */
function mergeNotes(existing: string | null, incoming: string | null): string | null {
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (existing.includes(incoming)) return existing;
  return `${existing} | ${incoming}`;
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

    const fullName = `${apellido}, ${nombre}`.replace(/^,\s*/, '').replace(/,\s*$/, '');
    const phone = rec.WhatsApp_E164?.trim() || null;
    const email = rec.Email?.trim() || null;
    const osNotes = buildNotes(rec.OS_Prepaga, rec.Fuente_Datos);

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
    let multiplePhoneMatch = false;

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
      } else if (data && data.length > 1) {
        multiplePhoneMatch = true;
        existingRow = data[0]; // Use first match, flag for review
      }
    }

    const now = new Date().toISOString();

    // -- Build review flags --------------------------------------------------
    const reviewReasons: string[] = [];
    if (birthdateInvalid) {
      reviewReasons.push(`Fecha_Nacimiento invalida: '${rec.Fecha_Nacimiento}'`);
    }
    if (hashDni && !existingRow) {
      reviewReasons.push(`DNI hash '${rawDni}' no matcheo por phone`);
    }
    if (multiplePhoneMatch) {
      reviewReasons.push(`2+ pacientes comparten el mismo telefono: ${phone}`);
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
