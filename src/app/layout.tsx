import type { Metadata } from 'next';
import { Playfair_Display, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const ibmPlex = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-ibm-plex',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.dralandaburo.com'),
  title: {
    default: 'Dra. Landaburo — Dermatología & Medicina Estética',
    template: '%s | Dra. Landaburo',
  },
  description:
    'Consultorio de medicina estética en Gualeguaychú, Entre Ríos. Tratamientos de armonización facial y corporal personalizados. Dra. Paula Landaburo.',
  keywords: [
    'dermatología',
    'medicina estética',
    'Gualeguaychú',
    'armonización facial',
    'toxina botulínica',
    'ácido hialurónico',
    'Nordlys',
    'hilos tensores',
    'biostimuladores',
    'mesoterapia',
  ],
  authors: [{ name: 'Dra. Paula Landaburo' }],
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: 'https://www.dralandaburo.com',
    siteName: 'Dra. Landaburo',
    title: 'Dra. Landaburo — Dermatología & Medicina Estética',
    description:
      'Consultorio de medicina estética en Gualeguaychú. Tratamientos personalizados de armonización facial y corporal.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={`${playfair.variable} ${ibmPlex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
