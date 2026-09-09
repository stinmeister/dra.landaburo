'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';



async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role, id').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard/operativo');
  return profile;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function savePost(formData: FormData) {
  const profile = await assertAdmin();

  const id            = (formData.get('id') as string)?.trim() || null;
  const title         = (formData.get('title') as string)?.trim();
  const excerpt       = (formData.get('excerpt') as string)?.trim() ?? '';
  const content       = (formData.get('content') as string)?.trim() ?? '';
  const cover         = (formData.get('cover_image_url') as string)?.trim() || null;
  const category      = (formData.get('category') as string)?.trim() ?? 'Dermatología';
  const isPublished   = formData.get('is_published') === 'true';
  const customSlug    = (formData.get('slug') as string)?.trim() || slugify(title ?? '');

  if (!title) return;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (id) {
    const { data: existing } = await admin.from('posts').select('published_at, is_published').eq('id', id).single();
    let postPublishedAt: string | null = null;
    if (isPublished) {
      postPublishedAt = existing?.published_at || now;
    } else {
      postPublishedAt = null;
    }

    await admin.from('posts').update({
      title,
      excerpt,
      content,
      cover_image_url: cover,
      category,
      slug: customSlug,
      is_published: isPublished,
      published_at: postPublishedAt,
      updated_at: now,
    }).eq('id', id);
  } else {
    await admin.from('posts').insert({
      title,
      excerpt,
      content,
      cover_image_url: cover,
      category,
      slug: customSlug,
      is_published: isPublished,
      author_profile_id: profile.id,
      published_at: isPublished ? now : null,
      updated_at: now,
    });
  }

  revalidatePath('/blog');
  revalidatePath('/dashboard/blog');
  redirect('/dashboard/blog');
}

export async function uploadBlogCover(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await assertAdmin();

    const file = formData.get('file') as File | null;
    if (!file) {
      return { success: false, error: 'No se recibió ningún archivo.' };
    }

    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'El archivo debe ser una imagen (JPG, PNG, WEBP).' };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'La imagen no debe superar los 5MB.' };
    }

    const admin = createAdminClient();
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `blog-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await admin.storage
      .from('products')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error('[Storage Blog Upload Error]:', uploadErr);
      return { success: false, error: `Error de almacenamiento: ${uploadErr.message}` };
    }

    const { data: publicUrlData } = admin.storage.from('products').getPublicUrl(fileName);
    return { success: true, url: publicUrlData.publicUrl };
  } catch (err: any) {
    console.error('[uploadBlogCover Error]:', err);
    return { success: false, error: err.message || 'Error al procesar la imagen' };
  }
}

export async function deletePost(formData: FormData) {
  await assertAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const admin = createAdminClient();
  await admin.from('posts').delete().eq('id', id);
  revalidatePath('/blog');
  revalidatePath('/dashboard/blog');
}
