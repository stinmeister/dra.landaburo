// /tienda/gift-cards — corrección 01/09/2026:
// El selector es por tratamiento/producto específico, NO por monto libre.
// El amount_ars se completa automáticamente desde el precio del item elegido.
// Catálogo acotado: se carga desde la API (filtrado por is_gift_card_eligible = true,
// o por una lista hardcodeada hasta que Paula confirme cuáles aplican).
import type { Metadata } from 'next';
import GiftCardForm from './GiftCardForm';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Gift Cards | Dra. Landaburo',
  description: 'Regalá una experiencia de cuidado. Gift Cards para tratamientos y productos del Consultorio Dra. Paula Landaburo.',
};

// Catálogo acotado (poco invasivos y cosmetología) — pendiente confirmación Paula/Agustín.
// Por ahora se filtra en memoria por nombre.
const ELIGIBLE_TREATMENT_SLUGS = [
  'limpieza-facial-profunda',
  'dermaplaning',
  'total-glow',
  'peeling-quimico',
  'radiofrecuencia',
  'consulta',
  'cosmetologia-basica',
];

export interface GiftCardItem {
  id: string;
  type: 'treatment' | 'product';
  name: string;
  price_ars: number;
  description?: string;
}

export default async function GiftCardsPage() {
  const supabase = await createClient();

  // Load eligible treatments
  const { data: treatments } = await supabase
    .from('treatments')
    .select('id, name, price_ars, slug')
    .in('slug', ELIGIBLE_TREATMENT_SLUGS)
    .order('name');

  // Load all active products (skincare — all qualify)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price_ars')
    .eq('is_active', true)
    .order('name');

  const catalog: GiftCardItem[] = [
    ...(treatments ?? []).map((t) => ({
      id: t.id,
      type: 'treatment' as const,
      name: t.name,
      price_ars: t.price_ars ?? 0,
    })),
    ...(products ?? []).map((p) => ({
      id: p.id,
      type: 'product' as const,
      name: p.name,
      price_ars: p.price_ars ?? 0,
    })),
  ];

  return (
    <>
      <Header />
      <main>
        <GiftCardForm catalog={catalog} />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
