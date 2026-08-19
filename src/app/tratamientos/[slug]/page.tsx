import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Instagram } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { Button } from '@/components/ui/Button';
import Typewriter from '@/components/ui/Typewriter';
import TreatmentFAQ from '@/components/tratamientos/TreatmentFAQ';
import { treatments, getTreatmentBySlug } from '@/data/treatments';
import styles from './page.module.css';

interface Props {
  params: Promise<{ slug: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  facial: 'Facial',
  corporal: 'Corporal',
  capilar: 'Capilar',
};

const TYPEWRITER_WORDS = ['armonía natural', 'salud cutánea', 'confianza', 'resultados reales'];

export async function generateStaticParams() {
  return treatments.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const treatment = getTreatmentBySlug(slug);
  if (!treatment) return { title: 'Tratamiento no encontrado | Dra. Paula Landaburo' };
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
  if (!treatment) notFound();

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

          {/* ── TASK-008: Hero full-bleed con imagen contextual ── */}
          <header className={styles.hero}>
            <Image
              src={treatment.heroImage}
              alt={treatment.title}
              fill
              priority
              className={styles.heroBg}
            />
            <div className={styles.heroOverlay} />
            <div className={styles.heroContainer}>
              <Link href="/tratamientos" className={styles.backLink}>
                <ArrowLeft size={16} />
                <span>Volver a tratamientos</span>
              </Link>
              <div className={styles.heroContent}>
                <span className={styles.category}>
                  {CATEGORY_LABELS[treatment.category] ?? treatment.category}
                </span>
                <h1 className={styles.title}>{treatment.title}</h1>
                {treatment.description && (
                  <p className={styles.description}>{treatment.description}</p>
                )}
                {/* TASK-010: Typewriter */}
                <p className={styles.typewriterLine}>
                  Buscamos:{' '}
                  <Typewriter words={TYPEWRITER_WORDS} className={styles.typewriter} />
                </p>
              </div>
            </div>
          </header>

          <section className={styles.contentSection}>
            <div className={styles.container}>
              <div className={styles.contentGrid}>

                {/* Main content */}
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

                {/* ── TASK-009: Sidebar con perfil académico ── */}
                <aside className={styles.sidebar}>
                  <div className={styles.doctorCard}>
                    <div className={styles.doctorPhoto}>
                      <Image
                        src="/images/WhatsApp-Image-2025-12-02-at-07.57.55_6c32d005.jpg"
                        alt="Dra. Paula Landaburo"
                        fill
                        className={styles.doctorImg}
                      />
                    </div>
                    <div className={styles.doctorInfo}>
                      <p className={styles.doctorLabel}>Médica a cargo</p>
                      <h3 className={styles.doctorName}>Dra. Paula Landaburo</h3>
                      <p className={styles.doctorBio}>
                        Médica orientada a la armonización facial y corporal. Más de 10 años acompañando pacientes con protocolos seguros, personalizados y naturales.
                      </p>
                      <a
                        href="https://www.instagram.com/dra_landaburo/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.doctorLink}
                      >
                        <Instagram size={15} />
                        @dra_landaburo
                      </a>
                    </div>
                  </div>

                  {relatedTreatments.length > 0 && (
                    <>
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
                    </>
                  )}
                </aside>
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
