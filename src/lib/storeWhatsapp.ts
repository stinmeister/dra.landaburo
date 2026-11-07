/**
 * Devuelve el número de WhatsApp de la tienda en formato solo dígitos para `wa.me/<digits>`.
 * Prioriza `store_config` (si se provee) y luego las variables de entorno
 * `NEXT_PUBLIC_STORE_WHATSAPP` / `STORE_WHATSAPP_NUMBER`.
 * No tiene ningún número escrito por defecto en el código: si no está configurado, devuelve `""`
 * para que las vistas oculten el botón de WhatsApp.
 */
export function getStoreWhatsappDigits(
  overrideEnv?: Record<string, string | undefined>,
  storeConfigWhatsapp?: string | null
): string {
  const fromConfig =
    typeof storeConfigWhatsapp === 'string' ? storeConfigWhatsapp.trim() : '';
  if (fromConfig) {
    return fromConfig.replace(/\D/g, '');
  }

  // Importante en Next.js: cuando no se pasa `overrideEnv`, leemos literalmente
  // `process.env.NEXT_PUBLIC_STORE_WHATSAPP` para que el compilador lo reemplace en bundles cliente.
  const raw = overrideEnv
    ? overrideEnv.NEXT_PUBLIC_STORE_WHATSAPP?.trim() ||
      overrideEnv.STORE_WHATSAPP_NUMBER?.trim() ||
      ''
    : process.env.NEXT_PUBLIC_STORE_WHATSAPP?.trim() ||
      process.env.STORE_WHATSAPP_NUMBER?.trim() ||
      '';

  return raw.replace(/\D/g, '');
}

export function formatStoreWhatsappDisplay(
  overrideEnv?: Record<string, string | undefined>,
  storeConfigWhatsapp?: string | null
): string {
  const digits = getStoreWhatsappDigits(overrideEnv, storeConfigWhatsapp);
  if (!digits) return '';
  // Formato legible para números móviles argentinos 549 + área + número
  const ar11 = digits.match(/^549(11)(\d{4})(\d{4})$/);
  if (ar11) return `+54 9 ${ar11[1]} ${ar11[2]}-${ar11[3]}`;
  const arInterior = digits.match(/^549(\d{3,4})(\d{2,3})(\d{4})$/);
  if (arInterior) return `+54 9 ${arInterior[1]} ${arInterior[2]}-${arInterior[3]}`;
  return `+${digits}`;
}

export function buildStoreWhatsappUrl(
  message: string,
  overrideEnv?: Record<string, string | undefined>,
  storeConfigWhatsapp?: string | null
): string {
  const digits = getStoreWhatsappDigits(overrideEnv, storeConfigWhatsapp);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
