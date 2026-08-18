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
      {/* ── Columna izquierda: texto ── */}
      <div className={styles.textSide}>
        <div className={styles.shimmer} />
        <div className={styles.content}>
          <ScrollAnimation animation="fade-up" delay={0}>
            <div className={styles.decorativeLine} />
            <p className={styles.subtitle}>{subtitle}</p>
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
          <ChevronDown className={styles.bounce} size={28} />
        </div>
      </div>

      {/* ── Columna derecha: retrato de la Dra. ── */}
      <div className={styles.imageSide}>
        <Image
          src="/images/WhatsApp-Image-2025-12-02-at-07.57.55_6c32d005.jpg"
          alt="Dra. Paula Landaburo — Medicina Estética"
          fill
          priority
          className={styles.portrait}
        />
        <div className={styles.imageOverlay} />
      </div>

      <div className={styles.waveContainer}>
        <svg className={styles.wave} viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path d="M0,0 C480,120 960,120 1440,0 L1440,120 L0,120 Z" fill="var(--color-bg)" />
        </svg>
      </div>
    </section>
  );
}
