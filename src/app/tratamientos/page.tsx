import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { treatments } from '@/data/treatments';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Tratamientos | Dra. Paula Landaburo',
  description: 'Conocé nuestros tratamientos de medicina estética: toxina botulínica, ácido hialurónico, Nordlys, y más.',
};

export default function TratamientosPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.container}>
            <h1 className={styles.title}>Tratamientos</h1>
            <p className={styles.subtitle}>
              Conocé nuestros tratamientos de medicina estética
            </p>
          </div>
        </section>

        <section className={styles.gridSection}>
          <div className={styles.container}>
            <div className={styles.grid}>
              {treatments.map((treatment) => (
                <Link 
                  href={`/tratamientos/${treatment.slug}`} 
                  key={treatment.slug}
                  className={styles.card}
                >
                  <div className={styles.cardContent}>
                    <span className={styles.category}>
                      {treatment.category === 'facial' ? 'Facial' : 'Corporal'}
                    </span>
                    <h2 className={styles.cardTitle}>{treatment.title}</h2>
                    <p className={styles.cardDesc}>{treatment.description}</p>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.linkText}>Ver más</span>
                    <ArrowRight size={20} className={styles.icon} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
