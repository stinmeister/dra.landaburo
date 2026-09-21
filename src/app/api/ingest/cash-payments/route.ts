import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/ingest/cash-payments
// Auth: Authorization: Bearer $INGEST_SECRET
//
// Endpoint para la ingesta de cobros reales diarios exportados de Calu (Pagos)
//
// Reglas:
//  1. payment_date es OBLIGATORIO a nivel lote (parámetro de consulta o campo de body).
//  2. Vinculación de paciente por nombre normalizado (coincidencia única -> patient_id;
//     múltiple o ninguna -> patient_id = null, plata nunca se retiene).
//  3. Guardarraíl de monedas: Si el medio de pago contiene USD y monto > 2.000,
//     se marca como monto fusionado en ARS [MONTO-FUSIONADO-NO-CONFIABLE].
//  4. Mapeo de profesionales: 'landaburo natalia' -> Paula, 'pasquet mercedes' -> Mechi, 'nati' -> Paula.
//  5. Exclusión de productos: 'URDI, PRODUCTOS' y 'venta de productos' se marcan como
//     is_product_sale = true y se excluyen de la facturación por profesional.
//  6. Deduplicación por external_id determinista.
//  7. Tolerancia ante DDL pendiente: Si la tabla cash_payments no existe aún en Supabase,
//     responde con reporte detallado sin error 500.

interface RawCashPaymentInput {
  tipo?: string;
  fecha?: string;            // Fecha del turno / cita (columna 'Fecha' en Calu)
  hora?: string;
  paciente?: string;         // 'Paciente/Proveedor'
  "paciente/proveedor"?: string;
  descripcion?: string;      // Tratamiento / concepto
  "medio de pago"?: string;
  medio_pago?: string;
  factura?: string;
  origen?: string;           // Profesional
  monto?: number | string;   // 'Monto pagado'
  "monto pagado"?: number | string;
  notas?: string;
  external_id?: string;
}

interface IngestCashPayload {
  payment_date?: string;     // YYYY-MM-DD (Obligatorio)
  source_file?: string;
  records: RawCashPaymentInput[];
}

function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9, ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ParsedName {
  norm: string;
  sortedTokens: string;
  firstLast: string;
  lastFirst: string;
}

function parseName(raw: string): ParsedName {
  const norm = normalizeText(raw);
  const tokens = norm.split(/[, ]+/).filter(Boolean);
  const sortedTokens = tokens.slice().sort().join(" ");

  let firstLast = norm;
  let lastFirst = norm;

  if (norm.includes(",")) {
    const parts = norm.split(",", 2).map((p) => p.trim());
    const last = parts[0] || "";
    const first = parts[1] || "";
    lastFirst = `${last} ${first}`.trim();
    firstLast = `${first} ${last}`.trim();
  } else {
    firstLast = norm;
    const words = norm.split(" ");
    if (words.length > 1) {
      lastFirst = `${words[words.length - 1]} ${words.slice(0, -1).join(" ")}`.trim();
    } else {
      lastFirst = norm;
    }
  }

  return { norm, sortedTokens, firstLast, lastFirst };
}

interface CachedPatient {
  id: string;
  full_name: string;
  parsed: ParsedName;
}

const STATIC_PROFESSIONAL_MAP: Record<string, { id: string; name: string }> = {
  "landaburo natalia": {
    id: "ed7a0c98-3333-4f08-8c44-09b8587652bd",
    name: "Dra. Paula Natalia Landaburo",
  },
  "pasquet mercedes": {
    id: "11123745-1a5a-428c-9bed-29de4355d59c",
    name: "Mercedes Pasquet",
  },
  nati: {
    id: "ed7a0c98-3333-4f08-8c44-09b8587652bd",
    name: "Dra. Paula Natalia Landaburo",
  },
  "paula landaburo": {
    id: "ed7a0c98-3333-4f08-8c44-09b8587652bd",
    name: "Dra. Paula Natalia Landaburo",
  },
  "natalia landaburo": {
    id: "ed7a0c98-3333-4f08-8c44-09b8587652bd",
    name: "Dra. Paula Natalia Landaburo",
  },
};

function normalizePaymentMethod(raw: string): string {
  const norm = normalizeText(raw);
  if (norm.includes("transferencia")) return "transferencia";
  if (norm.includes("efectivo usd") || (norm.includes("efectivo") && norm.includes("usd"))) return "efectivo_usd";
  if (norm.includes("efectivo")) return "efectivo";
  if (norm.includes("debito") || norm.includes("tarjeta de debito")) return "tarjeta_debito";
  if (norm.includes("credito") || norm.includes("tarjeta de credito")) return "tarjeta_credito";
  return norm || "otro";
}

export async function POST(req: NextRequest) {
  // ── 1. Autenticación ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const secret = process.env.INGEST_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parseo del Body y Fecha de Cobro de Lote ─────────────────────────────
  let payload: IngestCashPayload;
  try {
    const rawBody = await req.json();
    if (Array.isArray(rawBody)) {
      payload = { records: rawBody };
    } else if (rawBody && typeof rawBody === "object") {
      payload = rawBody;
    } else {
      throw new Error("Payload inválido");
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: `JSON inválido: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 }
    );
  }

  // Fecha de cobro requerida para el lote
  const paymentDate =
    payload.payment_date ||
    req.nextUrl.searchParams.get("payment_date") ||
    req.nextUrl.searchParams.get("fecha");

  if (!paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "La fecha de cobro ('payment_date' en formato YYYY-MM-DD) es obligatoria para todo el lote. El export de Calu no incluye la fecha de cobro en las columnas de filas.",
      },
      { status: 400 }
    );
  }

  const rawRecords = payload.records || [];
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return NextResponse.json(
      { success: false, message: "El lote no contiene registros para procesar ('records' vacío)." },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();

  // ── 3. Cargar padrón de pacientes para vinculación en memoria ───────────────
  let cachedPatients: CachedPatient[] = [];
  try {
    const { data: dbPatients } = await supabaseAdmin
      .from("patients")
      .select("id, full_name");
    if (dbPatients) {
      cachedPatients = dbPatients.map((p) => ({
        id: p.id,
        full_name: p.full_name || "",
        parsed: parseName(p.full_name || ""),
      }));
    }
  } catch (err) {
    console.warn("[ingest/cash-payments] Error cargando pacientes:", err);
  }

  // ── 4. Procesar y normalizar cada registro del lote ────────────────────────
  const processedRecords = [];
  const linkStats = { unique: 0, multiple: 0, none: 0 };
  let fusedCount = 0;
  let productSalesCount = 0;

  for (let i = 0; i < rawRecords.length; i++) {
    const rec = rawRecords[i];
    const rawPatient = (rec.paciente || rec["paciente/proveedor"] || "").trim();
    const rawService = (rec.descripcion || "").trim();
    const rawMethod = (rec.medio_pago || rec["medio de pago"] || "").trim();
    const rawOrigin = (rec.origen || "").trim();
    const rawDate = (rec.fecha || "").trim(); // Fecha de la cita/turno

    // Parsear monto
    let montoNum = 0;
    const rawMontoVal = rec.monto !== undefined ? rec.monto : rec["monto pagado"];
    if (typeof rawMontoVal === "number") {
      montoNum = rawMontoVal;
    } else if (typeof rawMontoVal === "string") {
      const cleanMonto = rawMontoVal.replace(/\./g, "").replace(/,/g, ".").trim();
      montoNum = parseFloat(cleanMonto) || 0;
    }

    // Clasificación de Moneda y Guardarraíl USD
    const isUsdMethod = /usd|dolar/i.test(rawMethod);
    let currency = "ARS";
    let amountArs = montoNum;
    let amountUsd: number | null = null;
    let isFused = false;
    const notesArr: string[] = [];

    if (isUsdMethod) {
      if (montoNum <= 2000) {
        // Dólar legítimo
        currency = "USD";
        amountUsd = montoNum;
        amountArs = 0;
      } else {
        // Monto fusionado (> US$ 2.000 es pesos mezclados con cobro en dólares)
        currency = "ARS";
        amountArs = montoNum;
        amountUsd = null;
        isFused = true;
        fusedCount++;
        notesArr.push("[MONTO-FUSIONADO-NO-CONFIABLE]");
      }
    }

    // Detección de Venta de Productos / URDI PRODUCTOS
    const normPatient = normalizeText(rawPatient);
    const normService = normalizeText(rawService);
    const isUrdi = normPatient.includes("urdi") || normPatient.includes("productos");
    const isProductSaleService = normService.includes("venta de productos") || normService.includes("producto");
    const isProductSale = isUrdi || isProductSaleService;

    if (isProductSale) {
      productSalesCount++;
      notesArr.push("[VENTA-MOSTRADOR]");
    }

    // Asignación de Profesional
    let profName: string | null = null;
    let profId: string | null = null;

    if (!isProductSale) {
      const normOrigin = normalizeText(rawOrigin);
      if (STATIC_PROFESSIONAL_MAP[normOrigin]) {
        profId = STATIC_PROFESSIONAL_MAP[normOrigin].id;
        profName = STATIC_PROFESSIONAL_MAP[normOrigin].name;
      } else if (normOrigin.includes("pasquet")) {
        profId = "11123745-1a5a-428c-9bed-29de4355d59c";
        profName = "Mercedes Pasquet";
      } else if (normOrigin.includes("landaburo") || normOrigin === "nati") {
        profId = "ed7a0c98-3333-4f08-8c44-09b8587652bd";
        profName = "Dra. Paula Natalia Landaburo";
      } else if (rawOrigin) {
        profName = rawOrigin;
      }
    }

    // Vinculación de Paciente por Nombre
    let matchedPatientId: string | null = null;
    if (rawPatient && !isUrdi) {
      const pParsed = parseName(rawPatient);
      const matches: CachedPatient[] = [];

      for (const cp of cachedPatients) {
        if (
          pParsed.firstLast === cp.parsed.firstLast ||
          pParsed.lastFirst === cp.parsed.lastFirst ||
          pParsed.firstLast === cp.parsed.lastFirst ||
          pParsed.lastFirst === cp.parsed.firstLast ||
          pParsed.sortedTokens === cp.parsed.sortedTokens
        ) {
          matches.push(cp);
        }
      }

      if (matches.length === 1) {
        matchedPatientId = matches[0].id;
        linkStats.unique++;
      } else if (matches.length > 1) {
        linkStats.multiple++;
        notesArr.push(`[PACIENTE-AMBIGUO: ${matches.length} coincidencias]`);
      } else {
        linkStats.none++;
        notesArr.push(`[SIN-PACIENTE: ${rawPatient}]`);
      }
    } else {
      linkStats.none++;
    }

    // Generación de Clave Determinista (external_id)
    const normMethod = normalizePaymentMethod(rawMethod);
    const generatedExternalId =
      rec.external_id ||
      `${paymentDate}|${normPatient || "anonimo"}|${montoNum}|${normMethod}|${normService || "general"}`;

    if (rec.notas) {
      notesArr.push(rec.notas);
    }

    // Parseo de fecha de cita si viene informada
    let appointmentDate: string | null = null;
    if (rawDate) {
      const cleanD = rawDate.replace(/\//g, "-").trim();
      const parts = cleanD.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          appointmentDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        } else {
          appointmentDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }
    }

    processedRecords.push({
      payment_date: paymentDate,
      appointment_date: appointmentDate,
      patient_id: matchedPatientId,
      patient_name_raw: rawPatient || "URDI, PRODUCTOS",
      service: rawService || null,
      payment_method: normMethod,
      professional_name: profName,
      professional_profile_id: profId,
      amount_ars: amountArs,
      amount_usd: amountUsd,
      currency,
      is_fused_amount: isFused,
      is_product_sale: isProductSale,
      source_file: payload.source_file || null,
      external_id: generatedExternalId,
      notes: notesArr.length > 0 ? notesArr.join(" ") : null,
    });
  }

  // ── 5. Inserción en Supabase con Tolerancia a DDL Pendiente ──────────────────
  try {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("cash_payments")
      .upsert(processedRecords, { onConflict: "external_id" })
      .select("id, external_id, amount_ars, currency");

    if (insertError) {
      // Si la tabla aún no fue creada por Agustín (error 42P01 / PGRST205)
      if (insertError.code === "PGRST205" || insertError.message?.includes("cache")) {
        return NextResponse.json(
          {
            success: true,
            ddl_pending: true,
            message:
              "Lote validado y transformado exitosamente. La tabla 'cash_payments' aún no existe en Supabase (DDL pendiente de ejecución por Agustín Landaburo).",
            summary: {
              payment_date: paymentDate,
              total_records: processedRecords.length,
              link_stats: linkStats,
              fused_amounts: fusedCount,
              product_sales: productSalesCount,
              records_sample: processedRecords.slice(0, 3),
            },
          },
          { status: 202 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: `Error al persistir en cash_payments: ${insertError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ddl_pending: false,
      message: `Lote procesado e insertado correctamente en cash_payments (${inserted?.length || 0} registros).`,
      inserted_count: inserted?.length || 0,
      link_stats: linkStats,
      fused_amounts: fusedCount,
      product_sales: productSalesCount,
      records: inserted,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: `Excepción en la persistencia: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
