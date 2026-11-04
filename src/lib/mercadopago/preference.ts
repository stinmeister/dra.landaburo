/**
 * Constructores puros de preferencias de Checkout Pro (Mercado Pago).
 * Sin dependencias de red ni de base de datos para permitir verificación determinística.
 */

/**
 * Mitigación temporal de FIX-129 (revisar cuando el arreglo de fondo del webhook esté desplegado):
 * - `binary_mode: true` fuerza resolución instantánea (`approved` o `rejected`), evitando cobros
 *   en estado `pending` / `in_process` (incluida revisión antifraude de tarjeta).
 * - `excluded_payment_types` excluye los medios offline no instantáneos (`ticket`, `atm`).
 *   Nota: `bank_transfer` queda pendiente de confirmar contra `GET /v1/payment_methods` de la cuenta
 *   cuando se regularice `MP_ACCESS_TOKEN` en producción; nunca se excluyen `credit_card`,
 *   `debit_card`, `prepaid_card` ni `account_money`.
 */
export const INSTANT_ONLY_PAYMENT_METHODS = {
  excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
} as const;

export interface OrderPreferenceItemInput {
  id: string;
  name: string;
  quantity: number;
  unitPriceArs: number;
}

export interface BuildOrderPreferenceParams {
  orderId: string;
  siteUrl: string;
  items: OrderPreferenceItemInput[];
  buyer: {
    name: string;
    email: string;
    phone?: string | null;
  };
}

export function buildOrderPreferenceBody(params: BuildOrderPreferenceParams) {
  const cleanName = params.buyer.name.trim();
  const cleanEmail = params.buyer.email.trim().toLowerCase();
  const cleanPhone = params.buyer.phone?.trim();

  // Mitigación temporal de FIX-129: solo pagos instantáneos (binary_mode + exclusión de medios offline).
  // Revisar cuando el arreglo de fondo de deduplicación/reconciliación del webhook esté desplegado.
  return {
    items: params.items.map((i) => ({
      id: i.id,
      title: i.name,
      quantity: i.quantity,
      unit_price: i.unitPriceArs,
      currency_id: 'ARS' as const,
    })),
    payer: {
      name: cleanName,
      email: cleanEmail,
      ...(cleanPhone ? { phone: { number: cleanPhone } } : {}),
    },
    external_reference: params.orderId,
    back_urls: {
      success: `${params.siteUrl}/tienda/pago/exito?order_id=${params.orderId}`,
      pending: `${params.siteUrl}/tienda/pago/pendiente?order_id=${params.orderId}`,
      failure: `${params.siteUrl}/tienda/pago/fallo?order_id=${params.orderId}`,
    },
    auto_return: 'approved' as const,
    binary_mode: true,
    payment_methods: {
      excluded_payment_types: INSTANT_ONLY_PAYMENT_METHODS.excluded_payment_types.map((t) => ({
        id: t.id,
      })),
    },
    statement_descriptor: 'DRA LANDABURO',
  };
}

export interface GiftCardPreferenceItemInput {
  title: string;
  quantity: number;
  unitPriceArs: number;
}

export interface BuildGiftCardPreferenceParams {
  giftCardId: string;
  siteUrl: string;
  items: GiftCardPreferenceItemInput[];
  sender: {
    name: string;
    email: string;
  };
}

export function buildGiftCardPreferenceBody(params: BuildGiftCardPreferenceParams) {
  // Mitigación temporal de FIX-129: solo pagos instantáneos (binary_mode + exclusión de medios offline).
  // Revisar cuando el arreglo de fondo de deduplicación/reconciliación del webhook esté desplegado.
  return {
    items: params.items.map((item, idx) => ({
      id: `${params.giftCardId}_${idx + 1}`,
      title: `Gift Card — ${item.title}`,
      quantity: item.quantity,
      unit_price: item.unitPriceArs,
      currency_id: 'ARS' as const,
    })),
    payer: {
      name: params.sender.name.trim(),
      email: params.sender.email.trim().toLowerCase(),
    },
    external_reference: `giftcard:${params.giftCardId}`,
    back_urls: {
      success: `${params.siteUrl}/tienda/pago/exito?gift_card=${params.giftCardId}`,
      pending: `${params.siteUrl}/tienda/pago/pendiente?gift_card=${params.giftCardId}`,
      failure: `${params.siteUrl}/tienda/pago/fallo?gift_card=${params.giftCardId}`,
    },
    auto_return: 'approved' as const,
    binary_mode: true,
    payment_methods: {
      excluded_payment_types: INSTANT_ONLY_PAYMENT_METHODS.excluded_payment_types.map((t) => ({
        id: t.id,
      })),
    },
    statement_descriptor: 'DRA LANDABURO GIFT',
  };
}
