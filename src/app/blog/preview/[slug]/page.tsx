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
        {/* Preview notification banner */}
        <div
          style={{
            backgroundColor: '#fffaf0',
            borderBottom: '2px solid #dd6b20',
            padding: '0.85rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong style={{ color: '#7b341e', fontSize: '0.875rem' }}>
                Vista Previa de Borrador ({post.is_published ? 'Publicado' : 'No Publicado'})
              </strong>
              <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                Solo visible para el equipo. {formattedUpdated && `Última edición: ${formattedUpdated}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link
              href={`/dashboard/blog/${post.id}`}
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#2d3748',
                backgroundColor: '#edf2f7',
                padding: '0.35rem 0.75rem',
                borderRadius: '4px',
                textDecoration: 'none',
              }}
            >
              ✏️ Editar en Dashboard
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
              {post.content
                ? post.content
                    .split('\n')
                    .filter(Boolean)
                    .map((para: string, i: number) => <p key={i}>{para}</p>)
                : <p style={{ color: '#a0aec0', fontStyle: 'italic' }}>Este artículo aún no contiene texto.</p>}
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
