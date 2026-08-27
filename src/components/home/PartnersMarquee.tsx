import Image from 'next/image';
import styles from './PartnersMarquee.module.css';

const partners = [
  { name: 'Nordlys', logo: '/images/partners/nordlys.svg' },
  { name: 'Allergan', logo: '/images/partners/allergan.svg' },
  { name: 'Galderma', logo: '/images/partners/galderma.svg' },
  { name: 'Sculptra', logo: '/images/partners/sculptra.svg' },
  { name: 'Radiesse', logo: '/images/partners/radiesse.svg' },
  { name: 'Juvederm', logo: '/images/partners/juvederm.svg' },
  { name: 'Merz Aesthetics', logo: '/images/partners/merz.svg' },
  { name: 'Restylane', logo: '/images/partners/restylane.svg' },
  { name: 'Stylage', logo: '/images/partners/stylage.svg' },
  { name: 'Sulderm', logo: '/images/partners/sulderm.svg' },
];

export default function PartnersMarquee() {
  // Duplicamos la lista para el loop infinito sin JS
  const list = [...partners, ...partners];

  return (
    <section className={styles.section}>
      <p className={styles.label}>Laboratorios & tecnologías aliadas</p>
      <div className={styles.track}>
        <div className={styles.marquee}>
          {list.map((partner, i) => (
            <div key={`${partner.name}-${i}`} className={styles.item}>
              <Image
                src={partner.logo}
                alt={partner.name}
                width={140}
                height={42}
                className={styles.logoImg}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
