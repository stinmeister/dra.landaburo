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

const schemaOrg = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'MedicalClinic',
      '@id': 'https://www.dralandaburo.com/#clinic',
      name: 'Consultorio Dra. Paula Landaburo — Medicina Estética & Dermatología',
      url: 'https://www.dralandaburo.com',
      telephone: '+54-9-11-6968-4062',
      email: 'Paula@dralandaburo.com',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Leandro N. Alem 45',
        addressLocality: 'Gualeguaychú',
        addressRegion: 'Entre Ríos',
        postalCode: 'E2820',
        addressCountry: 'AR',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: -33.0094,
        longitude: -58.5178,
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '17:00',
        },
      ],
      medicalSpecialty: ['Dermatology', 'PlasticSurgery'],
      sameAs: ['https://www.instagram.com/dra_landaburo/'],
    },
    {
      '@type': 'Physician',
      '@id': 'https://www.dralandaburo.com/#physician',
      name: 'Dra. Paula Landaburo',
      url: 'https://www.dralandaburo.com/sobre-mi',
      worksFor: { '@id': 'https://www.dralandaburo.com/#clinic' },
      medicalSpecialty: ['Dermatology'],
      sameAs: ['https://www.instagram.com/dra_landaburo/'],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={`${playfair.variable} ${ibmPlex.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
