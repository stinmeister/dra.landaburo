import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Clock, Phone, Mail } from 'lucide-react';
import { siteContent } from '@/data/site-content';
import { createClient } from '@supabase/supabase-js';
import styles from './Footer.module.css';

async function getAttentionHours(): Promise<string> {
  const defaultHours = 'Lun-Vier: 10:00 – 19:00 hs, Sáb: Solo con cita previa';
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
      .from('store_config')
      .select('attention_hours')
      .eq('id', 1)
      .maybeSingle();

    if (!error && data?.attention_hours) {
      return data.attention_hours;
    }
  } catch {
    // fallback seguro si la columna no existe o hay error de red
  }
  return defaultHours;
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export default async function Footer({ attentionHours: propHours }: { attentionHours?: string } = {}) {
  const hoursText = propHours || (await getAttentionHours());
  return (
    <footer className={styles.footer}>
      <div className={styles.waveDivider}>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path d="M0,0 C480,120 960,120 1440,0 L1440,120 L0,120 Z" fill="var(--color-negro)"></path>
        </svg>
      </div>
      <div className={styles.footerContent}>
        <div className={styles.container}>
        {/* Col 1 */}
        <div className={styles.col}>
          <Link href="/" className={styles.logo}>
            <Image
              src="/images/cropped-ISO_LOGO-Editado-Editado.png"
              alt="Logo Dra. Landaburo"
              width={34}
              height={34}
              className={styles.logoIcon}
            />
            <div className={styles.logoTextGroup}>
              <span className={styles.logoTitle}>Dra. Landaburo</span>
              <span className={styles.logoSubtitle}>Dermatóloga</span>
            </div>
          </Link>
          <p className={styles.description}>
            Medicina estética avanzada. Tratamientos personalizados para pacientes, buscando resaltar la belleza natural con la más alta tecnología.
          </p>
          <div className={styles.links}>
            <Link href="/tratamientos" className={styles.link}>Tratamientos</Link>
            <Link href="/sobre-mi" className={styles.link}>Sobre Mí</Link>
            <Link href="/blog" className={styles.link}>Blog</Link>
            <Link href="/tienda" className={styles.link}>Tienda</Link>
          </div>
        </div>

        {/* Col 2 */}
        <div className={styles.col}>
          <h3 className={styles.title}>Consultorio y Horarios</h3>
          <div className={styles.infoItem}>
            <MapPin size={20} />
            <span>
              <strong>Consultorio:</strong> Leandro N. Alem 45<br />
              Gualeguaychú, Entre Ríos
            </span>
          </div>
          <div className={styles.infoItem}>
            <Clock size={20} />
            <span>
              {hoursText.includes(',') ? (
                hoursText.split(',').map((part, i) => (
                  <React.Fragment key={i}>
                    {part.trim()}
                    {i < hoursText.split(',').length - 1 && <br />}
                  </React.Fragment>
                ))
              ) : (
                hoursText
              )}
            </span>
          </div>
        </div>

        {/* Col 3 */}
        <div className={styles.col}>
          <h3 className={styles.title}>Contacto</h3>
          <div className={styles.infoItem}>
            <Phone size={20} />
            <a href={`tel:${siteContent.contact.phone.replace(/[^0-9+]/g, '')}`} className={styles.link}>
              {siteContent.contact.phoneDisplay}
            </a>
          </div>
          <div className={styles.infoItem}>
            <Mail size={20} />
            <a href={`mailto:${siteContent.contact.email}`} className={styles.link}>
              {siteContent.contact.email}
            </a>
          </div>
          
          <a 
            href="https://instagram.com/dra_landaburo" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.socialLink}
          >
            <InstagramIcon size={20} />
            <span>@dra_landaburo</span>
          </a>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <span>&copy; {new Date().getFullYear()} Dra. Paula Landaburo. Todos los derechos reservados.</span>
        <span>Desarrollado por Arbol</span>
      </div>
      </div>
    </footer>
  );
}
