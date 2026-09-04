'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { trackConfigureGiftCard } from '@/lib/tracking';
import styles from './GiftCardsCTA.module.css';

export default function GiftCardsCTA() {
  return (
    <section className={styles.section} aria-labelledby="gift-cards-title">
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.decorativeCornerTopLeft} aria-hidden="true" />
          <div className={styles.decorativeCornerBottomRight} aria-hidden="true" />
          
          <div className={styles.content}>
            <div className={styles.badge}>
              <Sparkles size={14} className={styles.badgeIcon} />
              <span>Experiencia de Cuidado</span>
            </div>

            <h2 id="gift-cards-title" className={styles.title}>
              Regalá un Momento para Cuidar la Piel
            </h2>

            <p className={styles.description}>
              Sorprendé a quien más querés con una Gift Card personalizada para tratamientos
              faciales, corporales, productos dermocosméticos o saldo libre a elección.
              Un regalo pensado para disfrutar de un momento de bienestar real.
            </p>

            <div className={styles.features}>
              <div className={styles.featureItem}>
                <CheckCircle2 size={16} className={styles.featureIcon} />
                <span>Tratamientos, cremas o saldo libre</span>
              </div>
              <div className={styles.featureItem}>
                <CheckCircle2 size={16} className={styles.featureIcon} />
                <span>Dedicatoria personalizada</span>
              </div>
              <div className={styles.featureItem}>
                <CheckCircle2 size={16} className={styles.featureIcon} />
                <span>Válida por 90 días</span>
              </div>
            </div>

            <div className={styles.actions}>
              <Link
                href="/tienda/gift-cards"
                className={styles.primaryBtn}
                onClick={() => trackConfigureGiftCard()}
              >
                <span>Configurar Gift Card</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
