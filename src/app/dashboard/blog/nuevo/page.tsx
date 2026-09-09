import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { savePost } from '../actions';
import PostForm from '@/components/dashboard/PostForm';

export const metadata: Metadata = { title: 'Nuevo artículo | Panel Dra. Landaburo' };

export default async function NuevoPostPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard/operativo');

  return <PostForm action={savePost} />;
}
