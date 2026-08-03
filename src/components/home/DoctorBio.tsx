import Link from 'next/link';
import { siteContent } from '@/data/site-content';
import styles from './DoctorBio.module.css';
import ScrollAnimation from '@/components/ui/ScrollAnimation';

export default function DoctorBio() {
  const { label, title, text } = siteContent.doctorBio;

  return (
    <section className={styles.doctorBio}>
      <div className={styles.container}>
        <ScrollAnimation animation="fade-up" className={styles.textContent}>
          <span className={styles.label}>{label}</span>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.text}>{text}</p>
          <div className={styles.actions}>
            <Link href="/sobre-mi" className={styles.cta}>
              Más sobre mí
            </Link>
          </div>
        </ScrollAnimation>
        
        <ScrollAnimation animation="fade-in" delay={0.2} className={styles.imageContent}>
          <div className={styles.imagePlaceholder}></div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
