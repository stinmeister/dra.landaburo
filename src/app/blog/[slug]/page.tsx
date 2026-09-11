// /blog/[slug] — Artículo individual del blog. SSR para SEO.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/server';
import MarkdownRenderer from '@/components/blog/MarkdownRenderer';
import styles from './page.module.css';

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('posts')
    .select('title, excerpt')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();
  if (!post) return { title: 'Artículo no encontrado | Dra. Landaburo' };
  return {
    title: `${post.title} | Dra. Paula Landaburo`,
    description: post.excerpt,
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('posts')
    .select('id, title, excerpt, content, cover_image_url, category, published_at, updated_at')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!post) notFound();

  const pubDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;
  const isUpdated = post.updated_at && post.published_at && new Date(post.updated_at).getTime() - new Date(post.published_at).getTime() > 24 * 60 * 60 * 1000;
  const updDate = isUpdated
    ? new Date(post.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <>
      <Header />
      <main className={styles.main}>
        {/* Hero */}
        <header className={styles.hero}>
          {post.cover_image_url && (
            <Image src={post.cover_image_url} alt={post.title} fill priority className={styles.heroBg} />
          )}
          <div className={styles.heroOverlay} />
          <div className={styles.heroContainer}>
            <Link href="/blog" className={styles.backLink}>← Volver al Blog</Link>
            <span className={styles.category}>{post.category}</span>
            <h1 className={styles.title}>{post.title}</h1>
            {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
            <time className={styles.date}>
              {pubDate && `Publicado: ${pubDate}`}
              {updDate && ` · Actualizado: ${updDate}`}
            </time>
          </div>
        </header>

        {/* Contenido */}
        <article className={styles.article}>
          <div className={styles.container}>
            <div className={styles.content}>
              <MarkdownRenderer content={post.content} />
            </div>

            {/* Firma */}
            <div className={styles.signature}>
              <p className={styles.signatureName}>Dra. Paula Landaburo</p>
              <p className={styles.signatureRole}>Médica Especialista en Medicina Estética</p>
            </div>

            {/* CTA */}
            <div className={styles.cta}>
              <h2>¿Querés saber más?</h2>
              <p>Agendá una consulta personalizada para evaluar tu caso específico.</p>
              <Button href="/contacto" variant="primary">Agendar consulta</Button>
            </div>
          </div>
        </article>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
