import Link from 'next/link';
import styles from './TreatmentCategories.module.css';
import ScrollAnimation from '@/components/ui/ScrollAnimation';
import { siteContent } from '@/data/site-content';

export default function TreatmentCategories() {
  const categories = [
    { id: 'facial', title: siteContent.facial.label },
    { id: 'corporal', title: siteContent.body.label },
    { id: 'capilar', title: 'Tratamientos Capilares' },
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
