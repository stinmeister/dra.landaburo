import { siteContent } from '@/data/site-content';
import styles from './Welcome.module.css';
import ScrollAnimation from '@/components/ui/ScrollAnimation';

export default function Welcome() {
  const { label, title, text } = siteContent.welcome;

  return (
    <section className={styles.welcome}>
      <div className={styles.container}>
        <ScrollAnimation animation="fade-up" className={styles.textContent}>
          <span className={styles.label}>{label}</span>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.text}>{text}</p>
        </ScrollAnimation>
        
        <ScrollAnimation animation="fade-in" delay={0.2} className={styles.decorativeContent}>
          <div className={styles.decorativeLine}></div>
          <div className={styles.decorativeShape}></div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
