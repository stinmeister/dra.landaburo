import { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Blog | Dra. Paula Landaburo',
  description: 'Novedades y artículos sobre dermatología y medicina estética.',
};

export default function BlogPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.container}>
            <h1 className={styles.title}>Blog</h1>
          </div>
        </section>

        <section className={styles.contentSection}>
          <div className={styles.container}>
            <div className={styles.messageBox}>
              <p className={styles.message}>
                Próximamente estaremos compartiendo contenido sobre dermatología y medicina estética.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
