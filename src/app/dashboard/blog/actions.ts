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
    await admin.from('posts').update({
      title, excerpt, content, cover_image_url: cover, category,
      slug: customSlug, is_published: isPublished,
      published_at: isPublished ? now : null,
      updated_at: now,
    }).eq('id', id);
  } else {
    await admin.from('posts').insert({
      title, excerpt, content, cover_image_url: cover, category,
      slug: customSlug, is_published: isPublished,
      author_profile_id: profile.id,
      published_at: isPublished ? now : null,
    });
  }

  revalidatePath('/blog');
  revalidatePath('/dashboard/blog');
  redirect('/dashboard/blog');
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
