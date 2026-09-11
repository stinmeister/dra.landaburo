// /blog/preview/[slug] — Vista previa de artículos para Staff (admin, medico, operativo, cosmetologa).
// Si el usuario no tiene permisos de staff, devuelve 404 (notFound).
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import MarkdownRenderer from '@/components/blog/MarkdownRenderer';
import styles from '@/app/blog/[slug]/page.module.css';

interface Props {
  params: Promise<{ slug: string }>;
}

const STAFF_ROLES = ['admin', 'medico', 'operativo', 'cosmetologa', 'recepcionista'];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `[Preview] ${slug} | Dra. Paula Landaburo`,
    robots: { index: false, follow: false },
  };
}

export default async function BlogPreviewArticlePage({ params }: Props) {
  const { slug } = await params;

  // 1. Verify staff authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Return 404 to avoid leaking draft existence
    notFound();
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    notFound();
  }

  // 2. Fetch post using admin client (to fetch even unpublished drafts)
  const admin = createAdminClient();
  const { data: post } = await admin
    .from('posts')
    .select('id, title, excerpt, content, cover_image_url, category, is_published, published_at, updated_at, created_at')
    .eq('slug', slug)
    .single();

  if (!post) notFound();

  const formattedDate = post.published_at
    ? new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(post.published_at))
    : 'Borrador (Sin fecha de publicación)';

  const formattedUpdated = post.updated_at
    ? new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(post.updated_at))
    : null;

  return (
    <>
      <Header />
      <main className={styles.main}>
        {/* Preview notification banner — inequívoco para borrador clínico */}
        <div
          style={{
            backgroundColor: '#1c1c1c',
            borderBottom: '3px solid #C5A47E',
            padding: '1.25rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>⚠️</span>
            <div>
              <div
                style={{
                  color: '#f6ad55',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                BORRADOR CLÍNICO EN REVISIÓN — PENDIENTE DE VALIDACIÓN MÉDICA
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e0', marginTop: '0.2rem' }}>
                Este texto NO está aprobado para lectura de pacientes ni publicado en la web.
                {formattedUpdated && ` · Última edición técnica: ${formattedUpdated}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '3px',
                backgroundColor: post.is_published ? 'rgba(72,187,120,0.2)' : 'rgba(237,137,54,0.2)',
                color: post.is_published ? '#68d391' : '#f6ad55',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {post.is_published ? 'Estado: Publicado' : 'Estado: No Publicado'}
            </span>
            <Link
              href={`/dashboard/blog`}
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#1c1c1c',
                backgroundColor: '#C5A47E',
                padding: '0.45rem 0.9rem',
                borderRadius: '4px',
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
            >
              ✏️ Ir al Panel del Blog
            </Link>
          </div>
        </div>

        {/* Hero */}
        <header className={styles.hero}>
          {post.cover_image_url && (
            <Image
              src={post.cover_image_url}
              alt={post.title}
              fill
              priority
              className={styles.heroBg}
            />
          )}
          <div className={styles.heroOverlay} />
          <div className={styles.heroContainer}>
            <Link href="/blog" className={styles.backLink}>
              ← Volver al Blog
            </Link>
            <span className={styles.category}>{post.category}</span>
            <h1 className={styles.title}>{post.title}</h1>
            {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
            <time className={styles.date}>{formattedDate}</time>
          </div>
        </header>

        {/* Contenido */}
        <article className={styles.article}>
          <div className={styles.container}>
            <div className={styles.content}>
              <MarkdownRenderer content={post.content ?? ''} />
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
              <Button href="/contacto" variant="primary">
                Agendar consulta
              </Button>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
