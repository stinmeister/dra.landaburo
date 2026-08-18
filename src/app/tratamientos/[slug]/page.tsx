import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { Button } from '@/components/ui/Button';
import TreatmentFAQ from '@/components/tratamientos/TreatmentFAQ';
import { treatments, getTreatmentBySlug } from '@/data/treatments';
import styles from './page.module.css';

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return treatments.map((treatment) => ({
    slug: treatment.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const treatment = getTreatmentBySlug(slug);

  if (!treatment) {
    return {
      title: 'Tratamiento no encontrado | Dra. Paula Landaburo',
    };
  }

  return {
    title: `${treatment.title} | Dra. Paula Landaburo`,
    description: treatment.description,
  };
}

const faqSchema = (treatmentTitle: string) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '¿Cuánto dura el procedimiento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `La duración varía según el plan personalizado de ${treatmentTitle}. En la consulta inicial la Dra. Landaburo te informa los tiempos exactos.`,
      },
    },
    {
      '@type': 'Question',
      name: '¿Es doloroso?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'La mayoría de los procedimientos se realizan con anestesia local cuando es necesario. El nivel de incomodidad es mínimo.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Cuándo se ven los resultados?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Depende del tratamiento. Algunos ofrecen resultados inmediatos; otros muestran mejoras progresivas durante semanas o meses con un enfoque gradual y natural.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Cuánto tiempo de recuperación necesito?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'La gran mayoría de los tratamientos permiten retomar la actividad habitual el mismo día. En la consulta previa se indican los cuidados post-procedimiento específicos.',
      },
    },
  ],
});

export default async function TreatmentDetailPage({ params }: Props) {
  const { slug } = await params;
  const treatment = getTreatmentBySlug(slug);

  if (!treatment) {
    notFound();
  }

  const relatedTreatments = treatments
    .filter((t) => t.slug !== treatment.slug && t.category === treatment.category)
    .slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(treatment.title)) }}
      />
      <Header />
      <main className={styles.main}>
        <article>
          <header className={styles.hero}>
            <div className={styles.container}>
              <Link href="/tratamientos" className={styles.backLink}>
                <ArrowLeft size={16} />
                <span>Volver a tratamientos</span>
              </Link>
              <div className={styles.heroContent}>
                <span className={styles.category}>
                  {treatment.category === 'facial' ? 'Facial' : 'Corporal'}
                </span>
                <h1 className={styles.title}>{treatment.title}</h1>
                <p className={styles.description}>{treatment.description}</p>
              </div>
            </div>
          </header>

          <section className={styles.contentSection}>
            <div className={styles.container}>
              <div className={styles.contentGrid}>
                <div className={styles.mainContent}>
                  <div className={styles.textContent}>
                    <p>{treatment.fullDescription}</p>
                  </div>

                  <TreatmentFAQ />

                  <div className={styles.cta}>
                    <h2>¿Consultas sobre este tratamiento?</h2>
                    <p>Agendá una cita para que evaluemos tu caso de forma personalizada.</p>
                    <Button href="/contacto" variant="primary" size="lg">
                      Agendá tu consulta
                    </Button>
                  </div>
                </div>

                {relatedTreatments.length > 0 && (
                  <aside className={styles.sidebar}>
                    <h3 className={styles.sidebarTitle}>Otros tratamientos recomendados</h3>
                    <div className={styles.relatedList}>
                      {relatedTreatments.map((related) => (
                        <Link
                          href={`/tratamientos/${related.slug}`}
                          key={related.slug}
                          className={styles.relatedCard}
                        >
                          <h4>{related.title}</h4>
                          <p>{related.description}</p>
                        </Link>
                      ))}
                    </div>
                  </aside>
                )}
              </div>
            </div>
          </section>
        </article>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
