import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CarritoClient from './CarritoClient';

export const metadata: Metadata = {
  title: 'Tu carrito | Tienda',
  robots: { index: false },
};

export default function CarritoPage() {
  return (
    <>
      <Header />
      <CarritoClient />
      <Footer />
    </>
  );
}
