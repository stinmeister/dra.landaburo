// Regla única de presentación del nombre de quien pagó (FIX-143).
// La usan el Cierre del día y el Dashboard Ejecutivo para no divergir.
//
// Orden de precedencia:
//   1. Nombre de la paciente vinculada (patients.full_name)
//   2. payments.payer_name, marcado como "sin vincular"
//   3. "Paciente sin registrar" (solo si faltan los dos)

export const UNREGISTERED_PATIENT_LABEL = 'Paciente sin registrar';

export type PayerLinkStatus = 'linked' | 'unlinked_payer' | 'unregistered';

export interface PayerDisplay {
  name: string;
  status: PayerLinkStatus;
}

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolvePayerDisplay(
  linkedPatientName: string | null | undefined,
  payerName: string | null | undefined
): PayerDisplay {
  const linked = clean(linkedPatientName);
  if (linked) return { name: linked, status: 'linked' };

  const payer = clean(payerName);
  if (payer) return { name: payer, status: 'unlinked_payer' };

  return { name: UNREGISTERED_PATIENT_LABEL, status: 'unregistered' };
}
