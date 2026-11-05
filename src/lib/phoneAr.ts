/**
 * Validación suave y normalización de teléfonos móviles argentinos para WhatsApp (+54 9 ...).
 *
 * Regla exacta:
 * 1. Si el campo está vacío, no muestra aviso ni altera el valor.
 * 2. Si empieza con `+` distinto de `+54` o con `00` distinto de `0054` (ej. `+45 91 44 42 54`),
 *    se considera extranjero: muestra el aviso suave y NO reescribe el número.
 * 3. Para números con `+54` / `0054` / `54...` o locales sin prefijo internacional:
 *    - Se quitan caracteres no numéricos.
 *    - Se quita prefijo país `54` (y `9` móvil si ya estaba) o prefijo interurbano `0`.
 *    - Si quedan 12 dígitos con prefijo móvil local `15` tras el código de área (2 dígitos `11`,
 *      3 dígitos de `AR_3DIGIT_AREAS` o 4 dígitos del interior), se quita ese `15`.
 *    - Si el número nacional resultante tiene exactamente 10 dígitos y comienza con un código
 *      de área argentino válido (`11`, `2...` o `3...`), es válido (sin aviso) y se normaliza a
 *      `+54 9 <área> <abonado>`.
 *    - En cualquier otro caso (faltan dígitos de área, longitud distinta de 10, etc.), se muestra
 *      el aviso suave sin bloquear la compra y sin deformar lo escrito.
 */

const AR_3DIGIT_AREAS = new Set([
  '220', '221', '223', '230', '236', '237', '249',
  '260', '261', '263', '264', '266', '280',
  '291', '294', '297', '298', '299',
  '336', '341', '342', '343', '345', '348',
  '351', '353', '358', '362', '364',
  '370', '376', '379', '380', '381', '383', '385', '387', '388',
]);

function splitArgentineAreaLength(digits: string): 2 | 3 | 4 | null {
  if (digits.startsWith('11')) return 2;
  if (!/^[23]/.test(digits)) return null;
  if (AR_3DIGIT_AREAS.has(digits.slice(0, 3))) return 3;
  return 4;
}

function extractArgentineNational10(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Prefijo internacional explícito distinto de Argentina
  if (trimmed.startsWith('+') && !/^\+\s*54\b|^\+54/.test(trimmed)) {
    return null;
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return null;

  if (trimmed.startsWith('00') && !digitsOnly.startsWith('0054')) {
    return null;
  }

  let rest = digitsOnly;

  if (trimmed.startsWith('0054')) {
    rest = rest.slice(4);
  } else if (trimmed.startsWith('+')) {
    // Sabemos que empieza con +54
    rest = rest.slice(2);
  } else if (rest.startsWith('54') && rest.length >= 12) {
    rest = rest.slice(2);
  }

  // Si venía con el 9 móvil internacional (+54 9 ...)
  if (rest.startsWith('9') && rest.length >= 11) {
    rest = rest.slice(1);
  }

  // Quitar 0 interurbano inicial (ej. 03446..., 011...)
  if (rest.startsWith('0')) {
    rest = rest.slice(1);
  }

  const areaLen = splitArgentineAreaLength(rest);
  if (!areaLen) return null;

  // Quitar 15 móvil local tras código de área cuando totaliza 12 dígitos (área + 15 + abonado = 10 + 2)
  if (rest.length === 12 && rest.slice(areaLen, areaLen + 2) === '15') {
    rest = rest.slice(0, areaLen) + rest.slice(areaLen + 2);
  }

  if (rest.length !== 10) return null;
  if (!splitArgentineAreaLength(rest)) return null;

  return rest;
}

export function formatArgentineWhatsappDisplay(national10: string): string {
  const areaLen = splitArgentineAreaLength(national10) ?? 4;
  const area = national10.slice(0, areaLen);
  const subscriber = national10.slice(areaLen);

  if (areaLen === 2) {
    // +54 9 11 XXXX-XXXX
    return `+54 9 ${area} ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;
  }
  return `+54 9 ${area} ${subscriber}`;
}

export function normalizeArgentinePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const national10 = extractArgentineNational10(trimmed);
  if (!national10) {
    return trimmed;
  }

  return formatArgentineWhatsappDisplay(national10);
}

export function shouldWarnNonArgentinePhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return extractArgentineNational10(trimmed) === null;
}
