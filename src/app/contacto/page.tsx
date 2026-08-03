import { Metadata } from 'next';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Contactanos | Dra. Paula Landaburo',
  description: 'Agendá tu consulta o hacenos una pregunta. Estamos en Gualeguaychú, Entre Ríos.',
};

export default function ContactoPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.container}>
            <h1 className={styles.title}>Contactanos</h1>
            <p className={styles.subtitle}>
              Estamos para acompañarte. Escribinos para agendar una consulta o resolver tus dudas.
            </p>
          </div>
        </section>

        <section className={styles.contactSection}>
          <div className={styles.container}>
            <div className={styles.grid}>
              <div className={styles.formContainer}>
                <h2 className={styles.sectionTitle}>Envianos un mensaje</h2>
                <form className={styles.form}>
                  <div className={styles.formGroup}>
                    <label htmlFor="name" className={styles.label}>Nombre completo</label>
                    <input type="text" id="name" className={styles.input} required />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="email" className={styles.label}>Email</label>
                    <input type="email" id="email" className={styles.input} required />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="phone" className={styles.label}>Teléfono</label>
                    <input type="tel" id="phone" className={styles.input} />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="message" className={styles.label}>Mensaje</label>
                    <textarea id="message" rows={5} className={styles.textarea} required></textarea>
                  </div>
                  
                  <Button type="button" variant="primary" size="lg" className={styles.submitBtn}>
                    Enviar mensaje
                  </Button>
                </form>
              </div>

              <div className={styles.infoContainer}>
                <h2 className={styles.sectionTitle}>Información de contacto</h2>
                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <MapPin className={styles.icon} size={24} />
                    <div>
                      <h3>Dirección</h3>
                      <p>Leandro N. Alem 45<br />E2820 Gualeguaychú, Entre Ríos</p>
                    </div>
                  </div>
                  
                  <div className={styles.infoItem}>
                    <Phone className={styles.icon} size={24} />
                    <div>
                      <h3>Teléfono</h3>
                      <p>+54 9 11 6968-4062</p>
                    </div>
                  </div>
                  
                  <div className={styles.infoItem}>
                    <Mail className={styles.icon} size={24} />
                    <div>
                      <h3>Email</h3>
                      <p>Paula@dralandaburo.com</p>
                    </div>
                  </div>
                  
                  <div className={styles.infoItem}>
                    <Clock className={styles.icon} size={24} />
                    <div>
                      <h3>Horarios</h3>
                      <p>Lun - Vier: 9am – 5pm<br />Sáb: Solo con cita</p>
                    </div>
                  </div>
                </div>

                <div className={styles.mapContainer}>
                  <iframe 
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3345.986877995642!2d-58.514686!3d-33.003926!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95b007a82c68f27b%3A0xc316c0dfa72b0cfc!2sLeandro%20N.%20Alem%2045%2C%20Gualeguaych%C3%BA%2C%20Entre%20R%C3%ADos!5e0!3m2!1ses-419!2sar!4v1700000000000!5m2!1ses-419!2sar" 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    allowFullScreen 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Ubicación del consultorio"
                  ></iframe>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
