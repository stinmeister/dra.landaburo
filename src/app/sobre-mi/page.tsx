import { Metadata } from 'next';
import Image from 'next/image';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import StatsCounter from '@/components/home/StatsCounter';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Sobre Mí | Dra. Paula Landaburo',
  description: 'Conocé a la Dra. Paula Landaburo, médica especialista en dermatología y medicina estética.',
};

export default function SobreMiPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.container}>
            <h1 className={styles.title}>Sobre Mí</h1>
          </div>
        </section>

        <section className={styles.bioSection}>
          <div className={styles.container}>
            <div className={styles.grid}>
              <div className={styles.imageContainer}>
                <div className={styles.imagePlaceholder}>
                  {/* Replace with actual image when available */}
                  <span>Fotografía Dra. Landaburo</span>
                </div>
              </div>
              
              <div className={styles.textContent}>
                <h2 className={styles.heading}>Dra. Paula Landaburo</h2>
                <p className={styles.subheading}>Médica Especialista en Medicina Estética</p>
                
                <div className={styles.bioText}>
                  <p>
                    Mi visión de la medicina estética se centra en acompañar a cada paciente en la búsqueda de su mejor versión, priorizando la salud y respetando la naturalidad de sus rasgos. 
                  </p>
                  <p>
                    A lo largo de mi formación y trayectoria, he desarrollado un enfoque integral donde el equilibrio y la armonía son los pilares fundamentales. Entiendo que la belleza no es un estándar a alcanzar, sino la expresión más auténtica de bienestar y cuidado personal.
                  </p>
                  <p>
                    En mi consultorio, cada tratamiento es diseñado a medida luego de una evaluación médica exhaustiva. Utilizo tecnología de vanguardia, como el equipo Nordlys, y productos de primera línea para garantizar resultados seguros, elegantes y progresivos. 
                  </p>
                  <p>
                    Mi objetivo principal es que al mirarte al espejo te reconozcas, sintiéndote en confianza y plenitud con tu propia imagen, sin importar la etapa de la vida en la que te encuentres.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.statsSection}>
          <StatsCounter />
        </section>

        <section className={styles.valuesSection}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Nuestra Filosofía</h2>
            <div className={styles.valuesGrid}>
              <div className={styles.valueCard}>
                <h3>Naturalidad</h3>
                <p>Buscamos realzar tu belleza propia, respetando tus rasgos y evitando cambios abruptos o artificiales.</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Seguridad</h3>
                <p>Todos los tratamientos son realizados por profesionales médicos, utilizando productos avalados y tecnología de última generación.</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Personalización</h3>
                <p>Cada paciente es único. Diseñamos planes de tratamiento específicos según tus necesidades y objetivos particulares.</p>
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
