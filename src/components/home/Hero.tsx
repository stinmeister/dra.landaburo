import Image from 'next/image';
import Link from 'next/link';
import { siteContent } from '@/data/site-content';
import styles from './Hero.module.css';
import { ChevronDown } from 'lucide-react';
import ScrollAnimation from '@/components/ui/ScrollAnimation';

export default function Hero() {
  const { badge, title, text, cta, ctaHref, secondaryCta, secondaryCtaHref } = siteContent.hero;

  return (
    <section className={styles.hero}>
      {/* ── Columna izquierda: Foto del consultorio (Recepción y pared de madera) ── */}
      <div className={styles.imageSide}>
        <div className={styles.imageFrame}>
          <Image
            src="/images/consultorio-hero.jpg"
            alt="Consultorio Dra. Paula Landaburo — Medicina Estética"
            fill
            priority
            className={styles.consultorioImg}
            sizes="(max-width: 992px) 100vw, 50vw"
          />
        </div>
      </div>

      {/* ── Columna derecha: Texto y llamada a la acción ── */}
      <div className={styles.textSide}>
        <div className={styles.shimmer} />
        <div className={styles.content}>
          <ScrollAnimation animation="fade-up" delay={0}>
            <span className={styles.badge}>{badge || 'BIENVENIDOS'}</span>
          </ScrollAnimation>

          <ScrollAnimation animation="fade-up" delay={0.15}>
            <h1 className={styles.title}>{title}</h1>
          </ScrollAnimation>

          <ScrollAnimation animation="fade-up" delay={0.3}>
            <p className={styles.description}>{text}</p>
          </ScrollAnimation>

          <ScrollAnimation animation="fade-up" delay={0.45}>
            <div className={styles.actions}>
              <Link href={ctaHref || '/sobre-mi'} className={styles.cta}>
                {cta || 'Conocé más sobre el consultorio'}
              </Link>
              {secondaryCta && (
                <Link href={secondaryCtaHref || '/tratamientos'} className={styles.secondaryCta}>
                  {secondaryCta}
                </Link>
              )}
            </div>
          </ScrollAnimation>
        </div>

        <div className={styles.scrollIndicator}>
          <ChevronDown className={styles.bounce} size={26} />
        </div>
      </div>

      <div className={styles.waveContainer}>
        <svg className={styles.wave} viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path d="M0,0 C480,120 960,120 1440,0 L1440,120 L0,120 Z" fill="var(--color-bg, #ffffff)" />
        </svg>
      </div>
    </section>
  );
}
