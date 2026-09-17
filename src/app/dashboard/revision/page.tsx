import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Registros para Revisión | Panel Dra. Landaburo',
};

export default function RevisionPage() {
  redirect('/dashboard/ejecutivo?tab=revision');
}
