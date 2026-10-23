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

// Valores exactos permitidos por el constraint patients_rfm_segment_check en DB (14 valores):
// 'Campeón', 'Leal', 'No Perder', 'En Riesgo', 'Potencial Leal', 'Prometedor',
// 'Nuevo Paciente', 'Nuevo', 'Necesita Atención', 'Hibernando',
// 'Durmiente 2025', 'Inactivo pre-2025', 'Inactivo', 'Sin segmento'
const CANONICAL_RFM_SEGMENTS = new Set<string>([
  'Campeón',
  'Leal',
  'No Perder',
  'En Riesgo',
  'Potencial Leal',
  'Prometedor',
  'Nuevo Paciente',
  'Nuevo',
  'Necesita Atención',
  'Hibernando',
  'Durmiente 2025',
  'Inactivo pre-2025',
  'Inactivo',
  'Sin segmento',
]);

const RFM_MAP: Record<string, string> = {
  // 14 valores canónicos (case-insensitive y variantes sin tilde / con guion bajo)
  'campeón': 'Campeón',
  campeon: 'Campeón',
  campeones: 'Campeón',
  leal: 'Leal',
  leales: 'Leal',
  'no perder': 'No Perder',
  no_perder: 'No Perder',
  'en riesgo': 'En Riesgo',
  en_riesgo: 'En Riesgo',
  'potencial leal': 'Potencial Leal',
  potencial_leal: 'Potencial Leal',
  potencial: 'Potencial Leal',
  prometedor: 'Prometedor',
  prometedores: 'Prometedor',
  'nuevo paciente': 'Nuevo Paciente',
  nuevo_paciente: 'Nuevo Paciente',
  'nuevos pacientes': 'Nuevo Paciente',
  nuevo: 'Nuevo',
  nuevos: 'Nuevo',
  'necesita atención': 'Necesita Atención',
  'necesita atencion': 'Necesita Atención',
  necesita_atencion: 'Necesita Atención',
  hibernando: 'Hibernando',
  'durmiente 2025': 'Durmiente 2025',
  durmiente_2025: 'Durmiente 2025',
  durmiente: 'Durmiente 2025',
  durmientes: 'Durmiente 2025',
  'inactivo pre-2025': 'Inactivo pre-2025',
  'inactivo pre 2025': 'Inactivo pre-2025',
  inactivo_pre_2025: 'Inactivo pre-2025',
  inactivo: 'Inactivo',
  inactivos: 'Inactivo',
  'sin segmento': 'Sin segmento',
  sin_segmento: 'Sin segmento',
  // Alias heredados
  activo: 'Nuevo',
  activos: 'Nuevo',
};

function normalizeRfmSegment(raw: unknown): { mapped: string | null; note?: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { mapped: null };
  const trimmed = raw.trim();
  if (CANONICAL_RFM_SEGMENTS.has(trimmed)) {
    return { mapped: trimmed };
  }
  const clean = trimmed.toLowerCase();
  const matched = RFM_MAP[clean];
  if (matched) {
    const note =
      clean === 'activo' || clean === 'activos' || clean === 'durmiente' || clean === 'durmientes' || clean === 'potencial'
        ? `rfm_mapeado: '${trimmed}' -> '${matched}'`
        : undefined;
    return { mapped: matched, note };
  }
  return {
    mapped: 'Nuevo',
    note: `rfm_desconocido: '${trimmed}' no reconocido en constraint, asignado 'Nuevo'`,
  };
}

function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/** Normalise a DNI string: strip dots and spaces. */
function normalizeDni(raw: unknown): string {
  return toStr(raw).replace(/[.\s]/g, '');
}

/**
 * Returns true if the value looks like a hash (contains any letter),
 * meaning it is NOT a real DNI number.
 * Real Argentine DNIs are 7-8 digits only.
 */
function isHash(value: string): boolean {
  return /[a-zA-Z]/.test(value);
}

function buildValidIsoDate(yyyy: number, mm: number, dd: number): string | null {
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || !Number.isInteger(dd)) return null;
  if (yyyy < 1900 || yyyy > currentYear) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;

  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    isNaN(d.getTime()) ||
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() + 1 !== mm ||
    d.getUTCDate() !== dd
  ) {
    return null;
  }

  return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * Parse a birthdate in any of the supported unambiguous formats:
 * - DD-MM-YYYY
 * - DD/MM/YYYY
 * - YYYY-MM-DD
 * - Excel serial number (e.g. 32028 -> 1987-09-08; valid range 3654..47000)
 * Returns an ISO date string 'YYYY-MM-DD' or null on failure/ambiguity.
 */
function parseBirthdate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  // 1. Excel serial number (number or pure numeric string in valid date serial range 1910..2028)
  if (typeof raw === 'number' || /^\d{4,5}(?:\.0+)?$/.test(toStr(raw))) {
    const serial = Math.floor(Number(raw));
    // 3654 = 1910-01-01, 47000 = 2028-09-04 (excludes 4-digit birth years like 1985)
    if (Number.isFinite(serial) && serial >= 3654 && serial <= 47000) {
      const utcMs = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        return buildValidIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
    }
    return null;
  }

  const str = toStr(raw);
  if (!str) return null;

  // 2. YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
  if (isoMatch) {
    return buildValidIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // 3. DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(str);
  if (dmyMatch) {
    return buildValidIsoDate(Number(dmyMatch[3]), Number(dmyMatch[2]), Number(dmyMatch[1]));
  }

  return null;
}

/**
 * Build the notes string from OS_Prepaga and Fuente_Datos.
 */
function buildNotes(os: unknown, fuente: unknown): string | null {
  const osStr = toStr(os);
  const fuenteStr = toStr(fuente);
  const parts: string[] = [];
  if (osStr) parts.push(`OS: ${osStr}`);
  if (fuenteStr) parts.push(`Fuente: ${fuenteStr}`);
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
    try {
      // Validate required fields
    const apellido = toStr(rec.Apellido);
    const nombre = toStr(rec.Nombre);

    if (!apellido && !nombre) {
      rejectedDetail.push({ index: i, reason: 'Missing both Apellido and Nombre', record: rec });
      continue;
    }

    // Formato amigable para hablarle a la paciente: Nombre Apellido
    const fullName = [nombre, apellido].filter(Boolean).join(' ').trim();
    const phone = toStr(rec.WhatsApp_E164) || null;
    const email = toStr(rec.Email) || null;
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
    const rawBirthdate = toStr(rec.Fecha_Nacimiento);
    if (rawBirthdate) {
      birthdate = parseBirthdate(rec.Fecha_Nacimiento);
      if (birthdate === null) {
        birthdateInvalid = true;
        // Don't reject — insert with null and flag needs_review
      }
    }

    // -- DNI normalisation ---------------------------------------------------
    const rawDni = toStr(rec.DNI);
    let normalizedDni: string | null = null;
    let hashDni = false;

    if (rawDni) {
      const norm = normalizeDni(rawDni);
      if (isHash(norm)) {
        hashDni = true;
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
    }

    if (!existingRow && phone) {
      // Fallback lookup: by phone (runs when DNI is missing/hash OR when DNI was not found in DB)
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
        if (!normalizedDni) {
          reviewReasons.push(`vinculo_por_telefono: registro vinculado por teléfono (${phone}) al carecer de DNI unívoco`);
        }
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

      if (!toStr(dbRow.full_name) && fullName) {
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
      // If matched via phone and DB has no DNI (or had a hash), backfill the real numeric DNI
      if ((!dbRow.dni || isHash(String(dbRow.dni))) && normalizedDni) {
        changes['dni'] = normalizedDni;
      } else if (
        dbRow.dni &&
        !isHash(String(dbRow.dni)) &&
        normalizedDni &&
        String(dbRow.dni) !== normalizedDni
      ) {
        rejectedDetail.push({
          index: i,
          reason: `Insert/Update conflict: el teléfono ${phone} ya está asignado al DNI ${dbRow.dni} (registro entrante trae DNI ${normalizedDni})`,
          record: rec,
        });
        continue;
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
  } catch (recErr: unknown) {
    const errMsg = recErr instanceof Error ? recErr.message : String(recErr);
    rejectedDetail.push({ index: i, reason: `Unhandled record error: ${errMsg}`, record: rec });
  }
}

  // -- Persist BOTH review items AND rejected items to ingest_review (idempotente) --
  const allReviewAndRejected = [...needsReviewDetail, ...rejectedDetail];
  if (allReviewAndRejected.length > 0) {
    await persistReviewItems(
      allReviewAndRejected.map((item) => ({
        source: 'patients',
        record_identifier:
          item.record.DNI && normalizeDni(item.record.DNI)
            ? normalizeDni(item.record.DNI)
            : toStr(item.record.WhatsApp_E164) || toStr(item.record.Email) || null,
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
