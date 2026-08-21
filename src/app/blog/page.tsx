// /blog — Listado público de artículos. Solo muestra posts con is_published = true.
// Server Component con SSR para que el contenido sea indexable por buscadores.
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { createClient } from '@/lib/supabase/server';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Blog | Dra. Paula Landaburo',
  description: 'Novedades y artículos sobre dermatología y medicina estética por la Dra. Paula Landaburo.',
};

function readingTime(content: string): number {
  return Math.max(1, Math.round(content.split(/\s+/).length / 200));
}

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('id, slug, title, excerpt, cover_image_url, category, published_at, content')
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  const articles = posts ?? [];

  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.container}>
            <h1 className={styles.title}>Blog</h1>
            <p className={styles.heroSub}>Dermatología y medicina estética — artículos de la Dra. Landaburo</p>
          </div>
        </section>

        <section className={styles.contentSection}>
          <div className={styles.container}>
            {articles.length === 0 ? (
              <div className={styles.messageBox}>
                <p className={styles.message}>Próximamente estaremos compartiendo contenido sobre dermatología y medicina estética.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {articles.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className={styles.card}>
                    {post.cover_image_url && (
                      <div className={styles.cardImage}>
                        <Image src={post.cover_image_url} alt={post.title} fill style={{ objectFit: 'cover' }} />
                      </div>
                    )}
                    <div className={styles.cardBody}>
                      <span className={styles.cardCategory}>{post.category}</span>
                      <h2 className={styles.cardTitle}>{post.title}</h2>
                      {post.excerpt && <p className={styles.cardExcerpt}>{post.excerpt}</p>}
                      <div className={styles.cardMeta}>
                        <time>
                          {new Date(post.published_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </time>
                        <span className={styles.readTime}>{readingTime(post.content ?? '')} min de lectura</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
