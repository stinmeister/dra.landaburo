import type { Metadata } from 'next';
import GiftCardForm from './GiftCardForm';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Gift Cards | Dra. Landaburo',
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

  // 1. Cargar tratamientos de Cosmiatría / Cosmetología activos (Mercedes Pasquet)
  // Los tratamientos médicos (Dra. Landaburo) se regalan vía saldo libre previa evaluación diagnóstica.
  const { data: treatments } = await supabase
    .from('treatments')
    .select('id, title, price_ars, category, description')
    .eq('is_active', true)
    .ilike('category', '%cosmet%')
    .order('title');

  // 2. Cargar todos los productos de skincare activos desde Supabase
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price_ars, category, description')
    .eq('is_active', true)
    .order('name');

  const catalog: GiftCardCatalogItem[] = [
    ...(treatments ?? []).map((t) => ({
      id: t.id,
      type: 'treatment' as const,
      name: t.title,
      price_ars: t.price_ars ?? 0,
      category: t.category,
      description: t.description,
    })),
    ...(products ?? []).map((p) => ({
      id: p.id,
      type: 'product' as const,
      name: p.name,
      price_ars: p.price_ars ?? 0,
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
