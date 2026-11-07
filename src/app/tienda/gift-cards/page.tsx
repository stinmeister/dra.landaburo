import type { Metadata } from 'next';
import GiftCardForm from './GiftCardForm';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gift Cards',
  description: 'Regalá una experiencia de cuidado. Gift Cards combinables para tratamientos, productos dermocosméticos y saldo libre en Consultorio Dra. Paula Landaburo.',
};

export interface GiftCardCatalogItem {
  id: string;
  type: 'treatment' | 'product';
  name: string;
  price_ars: number;
  category?: string;
  description?: string;
}

export default async function GiftCardsPage() {
  const supabase = await createClient();

  // 1. Cargar tratamientos de Cosmiatría / Cosmetología activos con precio válido (> 0)
  // Los tratamientos médicos (Dra. Landaburo) requieren evaluación diagnóstica (ver crédito médico / monto libre).
  const { data: treatments } = await supabase
    .from('treatments')
    .select('id, title, price_ars, category, description')
    .eq('is_active', true)
    .ilike('category', '%cosmet%')
    .gt('price_ars', 0)
    .order('title');

  // 2. Cargar únicamente productos activos, públicos (sin medicamentos bajo receta) y con precio válido (> 0)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price_ars, category, description')
    .eq('is_active', true)
    .eq('is_public', true)
    .gt('price_ars', 0)
    .order('name');

  const catalog: GiftCardCatalogItem[] = [
    ...(treatments ?? [])
      .filter((t) => typeof t.price_ars === 'number' && Number.isFinite(t.price_ars) && t.price_ars > 0)
      .map((t) => ({
        id: t.id,
        type: 'treatment' as const,
        name: t.title,
        price_ars: Number(t.price_ars),
        category: t.category,
        description: t.description,
      })),
    ...(products ?? [])
      .filter((p) => typeof p.price_ars === 'number' && Number.isFinite(p.price_ars) && p.price_ars > 0)
      .map((p) => ({
        id: p.id,
        type: 'product' as const,
        name: p.name,
        price_ars: Number(p.price_ars),
        category: p.category,
        description: p.description,
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
