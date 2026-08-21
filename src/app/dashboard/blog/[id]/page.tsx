import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { savePost } from '../actions';
import { PostForm } from '../nuevo/page';

export const metadata: Metadata = { title: 'Editar artículo | Panel Dra. Landaburo' };

interface Props { params: Promise<{ id: string }> }

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard/operativo');

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: post } = await admin.from('posts').select('*').eq('id', id).single();
  if (!post) notFound();

  return <PostForm action={savePost} post={post} />;
}
