import Link from 'next/link';
import Image from 'next/image';
import styles from './TreatmentCategories.module.css';
import ScrollAnimation from '@/components/ui/ScrollAnimation';
import { siteContent } from '@/data/site-content';

export default function TreatmentCategories() {
  const categories = [
    { id: 'facial', title: siteContent.facial.label, image: '/images/cerrar-manos-dando-inyeccion-mujer-joven.jpg' },
    { id: 'corporal', title: siteContent.body.label, image: '/images/Carboxiterapia.jpg' },
    { id: 'capilar', title: 'Tratamientos Capilares', image: '/images/hombre-dandose-un-masaje-en-el-cuero-cabelludo-2.jpg' },
  ];

  return (
    <section className={styles.categories}>
      <div className={styles.container}>
        <div className={styles.grid}>
          {categories.map((cat, index) => (
            <ScrollAnimation 
              key={cat.id} 
              animation="fade-up" 
              delay={index * 0.2}
              className={styles.cardWrapper}
            >
              <Link href={`/tratamientos#${cat.id}`} className={styles.card}>
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  className={styles.image}
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className={styles.cardContent}>
                  <h3 className={styles.title}>{cat.title}</h3>
                </div>
              </Link>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
