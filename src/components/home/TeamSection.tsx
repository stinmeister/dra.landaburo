'use client';

import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import styles from './TeamSection.module.css';
import { teamMembers } from '@/data/team';

export default function TeamSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>Nuestro Equipo</span>
          <h2 className={styles.title}>Profesionales a tu servicio</h2>
          <p className={styles.subtitle}>
            Un equipo comprometido con la excelencia médica y el bienestar de cada paciente.
          </p>
        </div>

        <div className={styles.grid}>
          {teamMembers.map((member) => (
            <article key={member.id} className={`${styles.card} ${styles[member.category]}`}>
              <div className={styles.imageWrapper}>
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  className={styles.photo}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <span className={styles.badge}>{member.badge}</span>
              </div>
              <div className={styles.content}>
                <div className={styles.meta}>
                  <h3 className={styles.name}>{member.name}</h3>
                  <p className={styles.role}>{member.role}</p>
                </div>
                <p className={styles.bio}>{member.bio}</p>
                <div className={styles.specialties}>
                  <p className={styles.specialtiesLabel}>Especialidades</p>
                  <ul className={styles.specialtiesList}>
                    {member.specialties.map((s) => (
                      <li key={s} className={styles.specialty}>
                        <span className={styles.dot} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                {member.socialLinks?.instagram && (
                  <a
                    href={member.socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.instagramLink}
                    aria-label={`Instagram de ${member.name}`}
                  >
                    <ExternalLink size={16} />
                    <span>Seguir en Instagram</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
