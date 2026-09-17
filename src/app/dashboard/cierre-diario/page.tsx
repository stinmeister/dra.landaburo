import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Cierre Diario | Panel Dra. Landaburo',
};

export default async function CierreDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const resolvedParams = await searchParams;
  const rawDate = resolvedParams?.fecha?.trim();
  const query = rawDate ? `&fecha=${encodeURIComponent(rawDate)}` : '';
  redirect(`/dashboard/ejecutivo?tab=cierre-diario${query}`);
}
