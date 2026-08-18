import styles from './PartnersMarquee.module.css';

const partners = [
  'Nordlys',
  'Allergan',
  'Galderma',
  'Sculptra',
  'Sulderm',
  'Stylage',
  'Restylane',
  'Juvederm',
  'Merz',
  'Radiesse',
];

export default function PartnersMarquee() {
  // Duplicamos la lista para el loop infinito sin JS
  const list = [...partners, ...partners];

  return (
    <section className={styles.section}>
      <p className={styles.label}>Laboratorios & tecnologías aliadas</p>
      <div className={styles.track}>
        <div className={styles.marquee}>
          {list.map((name, i) => (
            <span key={i} className={styles.item}>
              {name}
              <span className={styles.dot} aria-hidden>·</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
