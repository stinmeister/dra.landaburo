'use client';

import { useState, useEffect, useRef } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './TestimonialsCarousel.module.css';
import { testimonials } from '@/data/testimonials';

export default function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const total = testimonials.length;

  const next = () => setCurrent((c) => (c + 1) % total);
  const prev = () => setCurrent((c) => (c - 1 + total) % total);

  useEffect(() => {
    if (!paused) {
      intervalRef.current = setInterval(next, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, current]);

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Consultorio Dra. Paula Landaburo',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: String(testimonials.length),
      bestRating: '5',
      worstRating: '1',
    },
    review: testimonials.map((t) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: t.patient_name },
      reviewRating: { '@type': 'Rating', ratingValue: String(t.rating) },
      reviewBody: t.quote,
      datePublished: t.date,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      <section
        className={styles.section}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className={styles.container}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Reseñas Verificadas</span>
            <h2 className={styles.title}>Lo que dicen nuestras pacientes</h2>
            <div className={styles.ratingBadge}>
              <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={16} className={styles.starIcon} />
                ))}
              </div>
              <span className={styles.ratingValue}>5.0</span>
              <span className={styles.ratingSource}>en Google Reviews</span>
            </div>
          </div>

          <div className={styles.track}>
            {testimonials.map((t, idx) => (
              <blockquote
                key={t.id}
                className={`${styles.card} ${idx === current ? styles.active : ''}`}
                aria-hidden={idx !== current}
              >
                <div className={styles.quoteIcon}>&ldquo;</div>
                <p className={styles.quote}>{t.quote}</p>
                <footer className={styles.footer}>
                  <div className={styles.authorInfo}>
                    <cite className={styles.authorName}>{t.patient_name}</cite>
                    <span className={styles.authorTreatment}>{t.treatment}</span>
                  </div>
                  <div className={styles.authorMeta}>
                    <span className={styles.source}>{t.source}</span>
                    <span className={styles.date}>{t.date}</span>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>

          <div className={styles.controls}>
            <button onClick={prev} className={styles.btn} aria-label="Anterior">
              <ChevronLeft size={20} />
            </button>
            <div className={styles.dots}>
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrent(idx)}
                  className={`${styles.dot} ${idx === current ? styles.dotActive : ''}`}
                  aria-label={`Ir a reseña ${idx + 1}`}
                />
              ))}
            </div>
            <button onClick={next} className={styles.btn} aria-label="Siguiente">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
