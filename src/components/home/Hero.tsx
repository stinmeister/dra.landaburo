import Link from 'next/link';
import { siteContent } from '@/data/site-content';
import styles from './Hero.module.css';
import { ChevronDown } from 'lucide-react';
import ScrollAnimation from '@/components/ui/ScrollAnimation';

export default function Hero() {
  const { title, subtitle } = siteContent.hero;

  return (
    <section className={styles.hero}>
      <div className={styles.overlay}>
        <div className={styles.content}>
          <ScrollAnimation animation="fade-up" delay={0}>
            <h2 className={styles.subtitle}>{subtitle}</h2>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fade-up" delay={0.2}>
            <h1 className={styles.title}>"{title}"</h1>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fade-up" delay={0.4}>
            <div className={styles.actions}>
              <Link href="/tratamientos" className={styles.cta}>
                Conocé los tratamientos
              </Link>
            </div>
          </ScrollAnimation>
        </div>

        <div className={styles.scrollIndicator}>
          <ChevronDown className={styles.bounce} size={32} />
        </div>
      </div>
    </section>
  );
}
