import Image from 'next/image';
import Link from 'next/link';
import { siteContent } from '@/data/site-content';
import styles from './Hero.module.css';
import { ChevronDown } from 'lucide-react';
import ScrollAnimation from '@/components/ui/ScrollAnimation';

export default function Hero() {
  const { title, subtitle } = siteContent.hero;

  return (
    <section className={styles.hero}>
      <Image 
        src="/images/especialista-en-procedimiento-facial-con-instrumento-scaled.jpg"
        alt="Especialista en procedimiento facial"
        fill
        priority
        className={styles.bgImage}
      />
      <div className={styles.overlay}>
        <div className={styles.shimmer}></div>
        <div className={styles.content}>
          <ScrollAnimation animation="fade-up" delay={0}>
            <div className={styles.decorativeLine}></div>
            <h2 className={styles.subtitle}>{subtitle}</h2>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fade-up" delay={0.2}>
            <h1 className={styles.title}>{title}</h1>
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
      
      <div className={styles.waveContainer}>
        <svg className={styles.wave} viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path d="M0,0 C480,120 960,120 1440,0 L1440,120 L0,120 Z" fill="var(--color-bg)"></path>
        </svg>
      </div>
    </section>
  );
}
