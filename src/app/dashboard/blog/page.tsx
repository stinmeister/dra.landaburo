// /dashboard/blog — CMS de artículos. Solo admin.
// Lista todos los posts (publicados y borradores) con acceso rápido a crear/editar/eliminar.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { deletePost } from './actions';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Blog CMS | Panel Dra. Landaburo' };

export default async function BlogDashPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: selfProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (selfProfile?.role !== 'admin') redirect('/dashboard/operativo');

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: posts } = await admin
    .from('posts')
    .select('id, slug, title, category, is_published, published_at, created_at')
    .order('created_at', { ascending: false });

  const rows = posts ?? [];
  const published = rows.filter((p) => p.is_published).length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Blog</h1>
          <p className={styles.subtitle}>{published} publicado{published !== 1 ? 's' : ''} · {rows.length - published} borrador{rows.length - published !== 1 ? 'es' : ''}</p>
        </div>
        <Link href="/dashboard/blog/nuevo" className={styles.newBtn}>+ Nuevo artículo</Link>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Título</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>No hay artículos aún. Creá el primero.</td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={styles.titleCell}>{p.title}</td>
                <td className={styles.catCell}>{p.category}</td>
                <td>
                  <span className={p.is_published ? styles.badgePublished : styles.badgeDraft}>
                    {p.is_published ? 'Publicado' : 'Borrador'}
                  </span>
                </td>
                <td className={styles.dateCell}>
                  {new Date(p.published_at ?? p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td>
                  <div className={styles.actions}>
                    <Link href={`/dashboard/blog/${p.id}`} className={styles.editBtn}>Editar</Link>
                    {p.is_published && (
                      <Link href={`/blog/${p.slug}`} target="_blank" className={styles.viewBtn}>Ver</Link>
                    )}
                    <form action={deletePost}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className={styles.deleteBtn}
                        onClick={(e) => { if (!confirm('¿Eliminar este artículo?')) e.preventDefault(); }}>
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
