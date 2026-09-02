import { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import Hero from '@/components/home/Hero';
import Welcome from '@/components/home/Welcome';
import TreatmentCategories from '@/components/home/TreatmentCategories';
import DoctorBio from '@/components/home/DoctorBio';
import StatsCounter from '@/components/home/StatsCounter';
import InstagramCTA from '@/components/home/InstagramCTA';
import PartnersMarquee from '@/components/home/PartnersMarquee';
import TeamSection from '@/components/home/TeamSection';
import TestimonialsCarousel from '@/components/home/TestimonialsCarousel';

export const metadata: Metadata = {
  title: 'Dra. Paula Landaburo | Medicina Estética',
  description: 'Descubrí tu mejor versión con tratamientos de medicina estética de vanguardia en Gualeguaychú.',
};

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Welcome />
        <TreatmentCategories />
        <PartnersMarquee />
        <DoctorBio />
        <StatsCounter />
        <TeamSection />
        <TestimonialsCarousel />
        <InstagramCTA />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
