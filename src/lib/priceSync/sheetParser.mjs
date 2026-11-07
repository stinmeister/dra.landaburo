/**
 * Parser determinístico y motor de planificación de sincronización de precios
 * desde la planilla oficial "Precios Nati Gualeguaychu." (Google Sheets).
 *
 * Reglas inquebrantables (Ítem 6):
 * 1. Sincroniza EXCLUSIVAMENTE filas que tengan `codigo_web` explícito (jamás vincula por nombre).
 * 2. Solo actualiza `price_ars` de productos existentes y tratamientos de cosmiatría existentes.
 * 3. Nunca crea, borra, pausa, reactiva ni renombra ítems.
 * 4. Tratamientos médicos de la Dra. Landaburo quedan excluidos (usan crédito por categoría, Ítem 5.b).
 * 5. Precios dudosos (rangos "$220.000/$250.000", dólares "420 dolares", texto, vacíos) se saltean y reportan.
 * 6. Salvaguarda del 50%: si |nuevo - actual| / actual > 0.50, NO se aplica y se reporta para confirmación.
 */

export const SUPPORTED_TABS = {
  PAU: 'Tratamientos Pau',
  MECHI: 'Tratamientos Mechi',
  HIFU: 'Hifu',
  SULDERM: 'Cremas Sulderm',
};

/**
 * Normaliza un encabezado de columna para detectar `codigo_web` (tolera mayúsculas, espacios y tildes).
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeHeader(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Parsea una celda de precio en pesos argentinos (ARS) con validación estricta anti-ambigüedad.
 *
 * Ejemplos válidos:
 *   "$50.000"          -> { ok: true, priceArs: 50000 }
 *   " $35.000"         -> { ok: true, priceArs: 35000 }
 *   "$10.000 x sesión" -> { ok: true, priceArs: 10000 }
 *   80000              -> { ok: true, priceArs: 80000 }
 *
 * Ejemplos rechazados:
 *   "$220.000/$250.000" -> { ok: false, reason: 'precio_rango_o_multiple' }
 *   "420 dolares "      -> { ok: false, reason: 'precio_en_dolares' }
 *   "" / "Consultar"    -> { ok: false, reason: 'precio_vacio_o_texto' }
 *
 * @param {unknown} rawCell
 * @returns {{ ok: true, priceArs: number } | { ok: false, reason: string, detail: string }}
 */
export function parseArsPriceCell(rawCell) {
  if (rawCell === null || rawCell === undefined) {
    return { ok: false, reason: 'precio_vacio', detail: 'Celda vacía' };
  }

  if (typeof rawCell === 'number') {
    if (!Number.isFinite(rawCell) || rawCell < 1000 || Math.floor(rawCell) !== rawCell) {
      return {
        ok: false,
        reason: 'precio_numerico_invalido',
        detail: `Valor numérico fuera de rango esperado en ARS: ${rawCell}`,
      };
    }
    return { ok: true, priceArs: rawCell };
  }

  const raw = String(rawCell).trim();
  if (!raw || raw === '-' || raw === '—') {
    return { ok: false, reason: 'precio_vacio', detail: 'Celda vacía o guion' };
  }

  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Rechazar explícitamente dólares (USD, U$S, U$D, dolares, dolar)
  if (/\b(dolar|dolares|usd)\b|u\$s|u\$d|us\$/i.test(normalized)) {
    return {
      ok: false,
      reason: 'precio_en_dolares',
      detail: `Expresado en moneda extranjera ("${raw}")`,
    };
  }

  // 2. Rechazar rangos o precios múltiples separados por "/", " - ", " a ", " o ", "+"
  if (raw.includes('/')) {
    return {
      ok: false,
      reason: 'precio_rango_o_multiple',
      detail: `Contiene barra o rango de precios ("${raw}")`,
    };
  }

  // Extraer todos los bloques numéricos tipo miles o enteros (ej. "50.000", "100.000", "45000")
  const numberTokens = raw.match(/\d{1,3}(?:\.\d{3})+|\d+/g) || [];
  if (numberTokens.length === 0) {
    return {
      ok: false,
      reason: 'precio_texto_sin_numero',
      detail: `Texto sin importe numérico ("${raw}")`,
    };
  }

  if (numberTokens.length > 1) {
    return {
      ok: false,
      reason: 'precio_rango_o_multiple',
      detail: `Contiene más de un número en la celda ("${raw}")`,
    };
  }

  // Verificar que el texto acompañante (quitando "$", espacios y el número) sea vacío o un sufijo unitario seguro
  const token = numberTokens[0];
  const remainder = normalized
    .replace(token, '')
    .replace(/\$/g, '')
    .replace(/\bars\b/g, '')
    .replace(/\bpesos\b/g, '')
    .trim();

  const SAFE_SUFFIX_RE =
    /^(?:(?:x|por)\s*(?:sesion|zona|unidad|aplicacion|mes|pack)|c\/u)?$/i;

  if (remainder && !SAFE_SUFFIX_RE.test(remainder)) {
    return {
      ok: false,
      reason: 'precio_con_texto_dudoso',
      detail: `Texto adicional ambiguo junto al precio ("${raw}")`,
    };
  }

  // Rechazar decimales con coma (ej. "0,5" mg confundido con precio)
  if (raw.includes(',')) {
    return {
      ok: false,
      reason: 'precio_formato_decimal_dudoso',
      detail: `Contiene coma decimal no esperada en precio entero ARS ("${raw}")`,
    };
  }

  const digitsOnly = token.replace(/\./g, '');
  const value = Number.parseInt(digitsOnly, 10);

  if (!Number.isFinite(value) || value < 1000) {
    return {
      ok: false,
      reason: 'precio_menor_al_minimo',
      detail: `Importe resultante (${value}) menor a $1.000 ARS ("${raw}")`,
    };
  }

  return { ok: true, priceArs: value };
}

/**
 * Encuentra índices de columnas cuyo encabezado sea `codigo_web` (o `codigo_web_*`) en las primeras filas.
 * @param {unknown[][]} rows
 * @param {number} maxHeaderScanRows
 * @returns {{ headerRowIndex: number, codeCols: number[] }}
 */
function findCodeColumns(rows, maxHeaderScanRows = 6) {
  const limit = Math.min(rows.length, maxHeaderScanRows);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    const codeCols = [];
    for (let c = 0; c < row.length; c++) {
      const h = normalizeHeader(row[c]);
      if (h === 'codigo_web' || h.startsWith('codigo_web_')) {
        codeCols.push(c);
      }
    }
    if (codeCols.length > 0) {
      return { headerRowIndex: r, codeCols };
    }
  }
  return { headerRowIndex: -1, codeCols: [] };
}

/**
 * Extrae las filas candidatas de las 4 pestañas oficiales de la planilla.
 *
 * Estructura oficial de columnas (0-indexed):
 * - `Tratamientos Pau`:
 *     - Bloque principal: Col B (1) = tratamiento, Col C (2) = USD, Col D (3) = ARS, Col E (4) = Mercedes UY (ignorar).
 *       Si hay un `codigo_web` con índice <= 5, lee nombre en Col B (1) y precio en Col D (3).
 *     - Bloque lateral suplementos: Col G (6) = nombre, Col H (7) = ARS.
 *       Si hay un `codigo_web` con índice >= 8 (ej. Col I = 8), lee nombre en Col G (6) y precio en Col H (7).
 * - `Tratamientos Mechi`:
 *     - Col A (0) = tratamiento, Col B (1) = precio ARS, Col C (2) = duración, Col D (3) = URDI (ignorar),
 *       Col E (4, o donde esté el header `codigo_web`) = `codigo_web`.
 * - `Hifu`:
 *     - Col A/B = zona, Col C (2) = precio ARS, Col D (3, o header `codigo_web`) = `codigo_web`.
 * - `Cremas Sulderm`:
 *     - Col B (1) = producto / encabezado categoría, Col D (3) = precio ARS,
 *       Col E (4) = combo (ignorar), Col F (5, o header `codigo_web`) = `codigo_web`.
 *
 * @param {Record<string, unknown[][]>} sheetsByTab
 */
export function extractCodedRowsFromWorkbook(sheetsByTab) {
  /** @type {Array<{ tab: string, rowNumber: number, codigoWeb: string, sheetLabel: string, rawPrice: unknown }>} */
  const extracted = [];
  /** @type {Array<{ tab: string, totalRowsRead: number, rowsWithCode: number, rowsWithoutCode: number, codeColumnsFound: number[] }>} */
  const tabStats = [];

  for (const [tabName, rows] of Object.entries(sheetsByTab || {})) {
    if (!Array.isArray(rows) || rows.length === 0) {
      tabStats.push({
        tab: tabName,
        totalRowsRead: 0,
        rowsWithCode: 0,
        rowsWithoutCode: 0,
        codeColumnsFound: [],
      });
      continue;
    }

    const { headerRowIndex, codeCols } = findCodeColumns(rows);
    if (codeCols.length === 0) {
      tabStats.push({
        tab: tabName,
        totalRowsRead: rows.length,
        rowsWithCode: 0,
        rowsWithoutCode: rows.length,
        codeColumnsFound: [],
      });
      continue;
    }

    let rowsWithCode = 0;
    let rowsWithoutCode = 0;

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const rowNumber = r + 1; // 1-indexed igual que Google Sheets
      let rowHadAnyCode = false;

      for (const codeCol of codeCols) {
        const rawCode = String(row[codeCol] ?? '').trim();
        if (!rawCode) continue;
        // Ignorar si repitieron el encabezado en medio de la hoja
        if (normalizeHeader(rawCode).startsWith('codigo_web')) continue;

        rowHadAnyCode = true;

        let sheetLabel = '';
        let rawPrice = undefined;

        if (tabName === SUPPORTED_TABS.PAU) {
          if (codeCol >= 8) {
            // Bloque G/H (suplementos) -> G (6): nombre, H (7): precio ARS
            sheetLabel = String(row[6] ?? '').trim();
            rawPrice = row[7];
          } else {
            // Bloque principal -> B (1): tratamiento, D (3): precio ARS (ignora C dólares y E Mercedes)
            sheetLabel = String(row[1] ?? '').trim();
            rawPrice = row[3];
          }
        } else if (tabName === SUPPORTED_TABS.MECHI) {
          // Col A (0): tratamiento, Col B (1): precio ARS (ignora Col D URDI)
          sheetLabel = String(row[0] ?? '').trim();
          rawPrice = row[1];
        } else if (tabName === SUPPORTED_TABS.HIFU) {
          // Zona en Col A (0) o Col B (1), precio ARS en Col C (2)
          sheetLabel = String(row[1] || row[0] || '').trim();
          rawPrice = row[2];
        } else if (tabName === SUPPORTED_TABS.SULDERM) {
          // Col B (1): producto, Col D (3): precio ARS (ignora Col E combo)
          sheetLabel = String(row[1] ?? '').trim();
          rawPrice = row[3];
        } else {
          continue;
        }

        extracted.push({
          tab: tabName,
          rowNumber,
          codigoWeb: rawCode.toLowerCase(),
          sheetLabel,
          rawPrice,
        });
      }

      if (rowHadAnyCode) rowsWithCode++;
      else rowsWithoutCode++;
    }

    tabStats.push({
      tab: tabName,
      totalRowsRead: Math.max(0, rows.length - (headerRowIndex + 1)),
      rowsWithCode,
      rowsWithoutCode,
      codeColumnsFound: codeCols,
    });
  }

  return { extracted, tabStats };
}

/**
 * Construye el plan completo de sincronización comparando las filas extraídas contra
 * los productos y tratamientos actuales de Supabase.
 *
 * @param {{
 *   sheetsByTab: Record<string, unknown[][]>,
 *   products: Array<{ id: string, slug: string, name: string, price_ars: number | null, is_active: boolean }>,
 *   treatments: Array<{ id: string, slug: string, title: string, category: string, price_ars: number | null, is_active: boolean }>,
 *   maxPctChange?: number
 * }} params
 */
export function planPriceSync({
  sheetsByTab,
  products,
  treatments,
  maxPctChange = 50,
}) {
  const { extracted, tabStats } = extractCodedRowsFromWorkbook(sheetsByTab);

  // Índices por slug (y fallback por id UUID)
  const productByCode = new Map();
  for (const p of products || []) {
    if (p.slug) productByCode.set(p.slug.toLowerCase(), p);
    if (p.id) productByCode.set(p.id.toLowerCase(), p);
  }

  const cosmiatriaByCode = new Map();
  const medicalByCode = new Map();
  for (const t of treatments || []) {
    const isCosmiatria = /cosmet/i.test(t.category || '');
    const targetMap = isCosmiatria ? cosmiatriaByCode : medicalByCode;
    if (t.slug) targetMap.set(t.slug.toLowerCase(), t);
    if (t.id) targetMap.set(t.id.toLowerCase(), t);
  }

  // Detectar códigos duplicados dentro de la planilla
  const occurrencesByCode = new Map();
  for (const item of extracted) {
    const arr = occurrencesByCode.get(item.codigoWeb) || [];
    arr.push(item);
    occurrencesByCode.set(item.codigoWeb, arr);
  }

  const updates = [];
  const unchanged = [];
  const skipped = [];

  const processedDuplicates = new Set();

  for (const row of extracted) {
    const dupes = occurrencesByCode.get(row.codigoWeb) || [];
    if (dupes.length > 1) {
      if (!processedDuplicates.has(row.codigoWeb)) {
        processedDuplicates.add(row.codigoWeb);
        skipped.push({
          tab: row.tab,
          rowNumber: row.rowNumber,
          codigoWeb: row.codigoWeb,
          sheetLabel: row.sheetLabel,
          rawPrice: row.rawPrice,
          reason: 'codigo_web_duplicado_en_planilla',
          detail: `El código "${row.codigoWeb}" aparece ${dupes.length} veces (${dupes
            .map((d) => `${d.tab} fila ${d.rowNumber}`)
            .join(', ')}). Debe aparecer una única vez.`,
        });
      }
      continue;
    }

    // 1. Verificar si corresponde a un tratamiento médico (prohibido sincronizar: va por crédito 5.b)
    if (medicalByCode.has(row.codigoWeb) && !productByCode.has(row.codigoWeb) && !cosmiatriaByCode.has(row.codigoWeb)) {
      const med = medicalByCode.get(row.codigoWeb);
      skipped.push({
        tab: row.tab,
        rowNumber: row.rowNumber,
        codigoWeb: row.codigoWeb,
        sheetLabel: row.sheetLabel,
        rawPrice: row.rawPrice,
        reason: 'tratamiento_medico_excluido',
        detail: `"${med.title}" pertenece a categoría médica (${med.category}); los tratamientos médicos se regalan por crédito (Ítem 5.b) y no sincronizan precio directo.`,
      });
      continue;
    }

    // 2. Resolver entidad existente (producto o tratamiento de cosmiatría)
    const prod = productByCode.get(row.codigoWeb);
    const cosm = !prod ? cosmiatriaByCode.get(row.codigoWeb) : null;

    if (!prod && !cosm) {
      skipped.push({
        tab: row.tab,
        rowNumber: row.rowNumber,
        codigoWeb: row.codigoWeb,
        sheetLabel: row.sheetLabel,
        rawPrice: row.rawPrice,
        reason: 'codigo_web_inexistente_en_web',
        detail: `No existe ningún producto ni tratamiento de cosmiatría con código "${row.codigoWeb}". El sincronizador nunca crea ítems nuevos.`,
      });
      continue;
    }

    // 3. Parsear precio ARS con reglas anti-ambigüedad
    const parsed = parseArsPriceCell(row.rawPrice);
    if (!parsed.ok) {
      skipped.push({
        tab: row.tab,
        rowNumber: row.rowNumber,
        codigoWeb: row.codigoWeb,
        sheetLabel: row.sheetLabel,
        rawPrice: row.rawPrice,
        reason: parsed.reason,
        detail: parsed.detail,
      });
      continue;
    }

    const entityType = prod ? 'product' : 'cosmetology_treatment';
    const entityId = prod ? prod.id : cosm.id;
    const entityName = prod ? prod.name : cosm.title;
    const oldPriceArs =
      (prod ? prod.price_ars : cosm.price_ars) !== null &&
      (prod ? prod.price_ars : cosm.price_ars) !== undefined
        ? Number(prod ? prod.price_ars : cosm.price_ars)
        : null;
    const newPriceArs = parsed.priceArs;

    // 4. Si el ítem en base no tenía precio válido (null o <= 0), pedir confirmación
    if (oldPriceArs === null || !Number.isFinite(oldPriceArs) || oldPriceArs <= 0) {
      skipped.push({
        tab: row.tab,
        rowNumber: row.rowNumber,
        codigoWeb: row.codigoWeb,
        sheetLabel: row.sheetLabel,
        rawPrice: row.rawPrice,
        reason: 'precio_actual_sin_base_requiere_confirmacion',
        detail: `"${entityName}" no tiene precio base válido en la web (${oldPriceArs}) y pasaría a $${newPriceArs}. Requiere confirmación manual.`,
      });
      continue;
    }

    // 5. Sin cambio
    if (Math.round(oldPriceArs) === Math.round(newPriceArs)) {
      unchanged.push({
        entityType,
        entityId,
        codigoWeb: row.codigoWeb,
        entityName,
        priceArs: newPriceArs,
        tab: row.tab,
        rowNumber: row.rowNumber,
      });
      continue;
    }

    // 6. Salvaguarda > 50%
    const pctChange = Number((((newPriceArs - oldPriceArs) / oldPriceArs) * 100).toFixed(2));
    if (Math.abs(pctChange) > maxPctChange) {
      skipped.push({
        tab: row.tab,
        rowNumber: row.rowNumber,
        codigoWeb: row.codigoWeb,
        sheetLabel: row.sheetLabel,
        rawPrice: row.rawPrice,
        oldPriceArs,
        newPriceArs,
        pctChange,
        reason: 'variacion_mayor_50_porciento',
        detail: `"${entityName}" cambiaría de $${oldPriceArs} a $${newPriceArs} (${pctChange > 0 ? '+' : ''}${pctChange}%), superando el tope de seguridad de ±${maxPctChange}%.`,
      });
      continue;
    }

    updates.push({
      entityType,
      entityId,
      codigoWeb: row.codigoWeb,
      entityName,
      oldPriceArs,
      newPriceArs,
      pctChange,
      tab: row.tab,
      rowNumber: row.rowNumber,
      rawPrice: String(row.rawPrice),
    });
  }

  const totalRowsRead = tabStats.reduce((acc, t) => acc + t.totalRowsRead, 0);
  const totalCodedRows = extracted.length;

  return {
    totalRowsRead,
    totalCodedRows,
    tabStats,
    updates,
    unchanged,
    skipped,
  };
}
