import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kiosco de Recepción | Dra. Landaburo',
  robots: { index: false, follow: false },
};

export default function KioscoLayout({ children }: { children: React.ReactNode }) {
  // Kiosk mode: NO header, NO footer, NO WhatsApp button
  return <>{children}</>;
}
