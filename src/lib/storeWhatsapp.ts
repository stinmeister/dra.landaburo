import { siteContent } from '@/data/site-content';

/**
 * Devuelve el número de WhatsApp de la tienda en formato solo dígitos para `wa.me/<digits>`.
 * Prioriza variables de entorno si estuvieran definidas; de lo contrario usa la fuente
 * única institucional (`siteContent.contact.whatsapp`), sin duplicar literales en código.
 */
export function getStoreWhatsappDigits(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv =
    env.NEXT_PUBLIC_STORE_WHATSAPP?.trim() ||
    env.STORE_WHATSAPP_NUMBER?.trim() ||
    '';
  const raw = fromEnv || siteContent.contact.whatsapp;
  return raw.replace(/\D/g, '');
}

export function buildStoreWhatsappUrl(
  message: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const digits = getStoreWhatsappDigits(env);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
