import { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import styles from './consentimientos.module.css';
import { FileText, Download, Shield, ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Consentimientos Médicos | Dra. Landaburo',
  description: 'Información y consentimientos informados de todos los procedimientos estéticos del Consultorio Dra. Paula Landaburo. Medicina estética segura en Gualeguaychú.',
  robots: { index: true, follow: true },
};

const consents = [
  {
    code: 'CI-01',
    title: 'Toxina Botulínica (Botox)',
    responsible: 'Dra. Paula Landaburo — M.P. 11.439',
    icon: '💉',
    description: 'Procedimiento de relajación muscular mediante toxina botulínica tipo A. Incluye zonas de aplicación, tiempo de latencia y contraindicaciones.',
    keyPoints: [
      'Zonas faciales: frente, entrecejo, patas de gallo, maseteros, cuello',
      'Efecto visible en 72h a 14 días, duración promedio 4-6 meses',
      'Contraindicado en embarazo, lactancia y enfermedades neuromusculares',
      'Posibles hematomas transitorios en zona de punción',
    ],
  },
  {
    code: 'CI-02',
    title: 'Ácido Hialurónico & Rellenos',
    responsible: 'Dra. Paula Landaburo — M.P. 11.439',
    icon: '✨',
    description: 'Tratamiento de relleno y voluminización con ácido hialurónico reticulado de uso médico. Cuidados post-inyección y protocolo de corrección con hialuronidasa.',
    keyPoints: [
      'Materiales reabsorbibles certificados por ANMAT',
      'No masajear zona tratada las primeras 48h',
      'Evitar calor intenso, saunas y ejercicio por 24h',
      'Disponibilidad de hialuronidasa para corrección si fuera necesario',
    ],
  },
  {
    code: 'CI-03',
    title: 'Bioestimuladores (Radiesse / Sculptra)',
    responsible: 'Dra. Paula Landaburo — M.P. 11.439',
    icon: '🔬',
    description: 'Tratamiento de estimulación de colágeno mediante bioestimuladores inyectables. Neocolagénesis progresiva con curva de resultados a 3 meses.',
    keyPoints: [
      'Resultados progresivos durante 3 a 6 meses',
      'Protocolo de masajes de 5 minutos, 5 veces al día por 5 días',
      'Recomendado en ciclo de 2 a 3 sesiones para resultados óptimos',
      'No apto para embarazadas o pacientes inmunosuprimidos',
    ],
  },
  {
    code: 'CI-04',
    title: 'PRP / PRF & Tratamiento Capilar',
    responsible: 'Dra. Paula Landaburo — M.P. 11.439',
    icon: '🩸',
    description: 'Tratamiento de bioestimulación con plasma rico en plaquetas o fibrina autóloga. Extracción sanguínea, centrifugación estéril cerrada y aplicación capilar o facial.',
    keyPoints: [
      'Sangre autóloga del propio paciente — sin riesgo de rechazo',
      'Centrifugación en sistema cerrado estéril de una sola vez',
      'Evolución capilar visible entre las 3 y 6 sesiones',
      'Contraindicado en plaquetopenia o tratamiento anticoagulante',
    ],
  },
  {
    code: 'CI-05',
    title: 'Cosmiatría & Peelings Químicos',
    responsible: 'Mercedes — Cosmiátrica Matriculada',
    icon: '🌿',
    description: 'Protocolos de limpieza facial profunda, exfoliación química controlada y tratamientos de aparatología estética no invasiva realizados por cosmiátrica profesional.',
    keyPoints: [
      'Uso obligatorio de FPS 50+ desde el día siguiente al peeling',
      'No retirar ni frotar la descamación natural de la piel',
      'Evitar exposición solar directa por 7 días post-peeling',
      'Informar alergias a ácidos o activos cosméticos antes del tratamiento',
    ],
  },
];

export default function ConsentimientosPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.shieldWrapper}>
              <Shield size={32} strokeWidth={1.5} className={styles.shieldIcon} />
            </div>
            <h1 className={styles.heroTitle}>Consentimientos Médicos<br />&amp; Información al Paciente</h1>
            <p className={styles.heroSubtitle}>
              En el Consultorio Dra. Paula Landaburo priorizamos tu seguridad, bienestar y autonomía.
              Aquí encontrarás toda la información sobre los procedimientos y los documentos de
              consentimiento informado requeridos por la legislación médica argentina.
            </p>
            <div className={styles.credentials}>
              <div className={styles.credItem}>
                <span className={styles.credLabel}>Matrícula Provincial</span>
                <span className={styles.credValue}>M.P. 11.439 — Entre Ríos</span>
              </div>
              <div className={styles.credDivider} />
              <div className={styles.credItem}>
                <span className={styles.credLabel}>Habilitación Consultorio</span>
                <span className={styles.credValue}>Habilitado — MSGER</span>
              </div>
              <div className={styles.credDivider} />
              <div className={styles.credItem}>
                <span className={styles.credLabel}>Marco Legal</span>
                <span className={styles.credValue}>Ley 26.529</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.gridSection}>
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <span className={styles.eyebrow}>Documentos Médicos</span>
              <h2 className={styles.sectionTitle}>Consentimientos por Procedimiento</h2>
              <p className={styles.sectionSubtitle}>
                Cada documento detalla el procedimiento, los riesgos conocidos, los cuidados
                posteriores y los derechos del paciente.
              </p>
            </div>

            <div className={styles.grid}>
              {consents.map((consent) => (
                <div key={consent.code} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>{consent.icon}</span>
                    <div>
                      <span className={styles.cardCode}>{consent.code}</span>
                      <h3 className={styles.cardTitle}>{consent.title}</h3>
                    </div>
                  </div>
                  <p className={styles.cardDescription}>{consent.description}</p>
                  <ul className={styles.keyPoints}>
                    {consent.keyPoints.map((point, idx) => (
                      <li key={idx} className={styles.keyPoint}>
                        <span className={styles.checkmark}>✓</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                  <div className={styles.cardFooter}>
                    <span className={styles.responsible}>{consent.responsible}</span>
                    <div className={styles.cardActions}>
                      <button className={styles.btnSecondary}>
                        <ExternalLink size={14} />
                        Leer Online
                      </button>
                      <button className={styles.btnPrimary}>
                        <Download size={14} />
                        Descargar PDF
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.legalSection}>
          <div className={styles.container}>
            <div className={styles.legalBox}>
              <FileText size={20} className={styles.legalIcon} />
              <div>
                <p className={styles.legalTitle}>Ley de Derechos del Paciente Nº 26.529</p>
                <p className={styles.legalText}>
                  Todo procedimiento médico requiere consentimiento informado previo. Usted tiene
                  derecho a recibir información completa sobre el tratamiento, sus riesgos y
                  alternativas, y puede revocar su consentimiento en cualquier momento.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
