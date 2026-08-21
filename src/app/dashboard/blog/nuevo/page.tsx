import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { savePost } from '../actions';
import styles from '../page.module.css';

export const metadata: Metadata = { title: 'Nuevo artículo | Panel Dra. Landaburo' };

export default async function NuevoPostPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard/operativo');

  return <PostForm action={savePost} />;
}

function PostForm({ action, post }: { action: (f: FormData) => Promise<void>; post?: Record<string, string | boolean | null> }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{post ? 'Editar artículo' : 'Nuevo artículo'}</h1>
      <form action={action} className={styles.postForm}>
        {post?.id && <input type="hidden" name="id" value={String(post.id)} />}

        <div className={styles.formGrid2}>
          <div className={styles.field}>
            <label className={styles.label}>Título *</label>
            <input name="title" type="text" required className={styles.input} defaultValue={String(post?.title ?? '')} placeholder="Cuidado de la piel en verano" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Categoría</label>
            <select name="category" className={styles.input} defaultValue={String(post?.category ?? 'Dermatología')}>
              {['Dermatología', 'Medicina Estética', 'Cuidado de la piel', 'Tecnología médica', 'Consejos'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>Slug (URL amigable)</label>
            <input name="slug" type="text" className={styles.input} defaultValue={String(post?.slug ?? '')} placeholder="cuidado-piel-verano (se genera automáticamente si lo dejás vacío)" />
          </div>
          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>Resumen (excerpt)</label>
            <input name="excerpt" type="text" className={styles.input} defaultValue={String(post?.excerpt ?? '')} placeholder="Un párrafo breve que aparece en el listado del blog..." />
          </div>
          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>URL imagen de portada</label>
            <input name="cover_image_url" type="url" className={styles.input} defaultValue={String(post?.cover_image_url ?? '')} placeholder="https://..." />
          </div>
          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label}>Contenido (Markdown o texto)</label>
            <textarea name="content" rows={14} className={styles.textarea} defaultValue={String(post?.content ?? '')} placeholder="Escribí el cuerpo del artículo aquí..." />
          </div>
        </div>

        <div className={styles.formFooter}>
          <div className={styles.publishToggle}>
            <label className={styles.checkLabel}>
              <input name="is_published" type="checkbox" value="true" defaultChecked={post?.is_published === true} className={styles.checkbox} />
              Publicar inmediatamente
            </label>
          </div>
          <div className={styles.footerBtns}>
            <a href="/dashboard/blog" className={styles.cancelBtn}>Cancelar</a>
            <button type="submit" className={styles.saveBtn}>Guardar</button>
          </div>
        </div>
      </form>
    </div>
  );
}

export { PostForm };
