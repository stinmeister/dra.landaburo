import { siteContent } from '@/data/site-content';
import styles from './InstagramCTA.module.css';
import ScrollAnimation from '@/components/ui/ScrollAnimation';

function InstagramIcon({ size = 24, className, strokeWidth = 1.5 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export default function InstagramCTA() {
  const { label, handle, url } = siteContent.instagramCta;

  return (
    <section className={styles.instagramCta}>
      <div className={styles.container}>
        <ScrollAnimation animation="fade-up" className={styles.content}>
          <span className={styles.label}>{label}</span>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.link}
          >
            <InstagramIcon size={40} className={styles.icon} strokeWidth={1.5} />
            <h2 className={styles.handle}>{handle}</h2>
          </a>
        </ScrollAnimation>
      </div>
    </section>
  );
}
