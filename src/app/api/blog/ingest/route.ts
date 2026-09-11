import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Auth: Bearer token validation
    const authHeader = req.headers.get('authorization');
    const secret = process.env.BLOG_SYNC_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      slug,
      title,
      category,
      excerpt,
      content,
      content_markdown,
      cover_image_url,
      cover_image,
      hero_image,
      author_id,
      published_at,
      is_published = true,
      status,
    } = body;

    const finalContent = content || content_markdown;
    const finalCoverImage = cover_image_url || cover_image || hero_image || null;

    if (!slug || !title || !category || !excerpt || !finalContent) {
      return NextResponse.json(
        {
          success: false,
          message: 'Faltan campos requeridos: slug, title, category, excerpt, content/content_markdown',
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('posts')
      .upsert(
        {
          slug,
          title,
          category,
          excerpt,
          content: finalContent,
          cover_image_url: finalCoverImage,
          author_id: author_id || null,
          status: status || (is_published ? 'published' : 'draft'),
          is_published: typeof is_published === 'boolean' ? is_published : true,
          published_at: published_at || now,
          updated_at: now,
        },
        { onConflict: 'slug' }
      )
      .select('id, slug')
      .single();

    if (error) {
      console.error('Blog ingest error into posts:', error);
      return NextResponse.json(
        { success: false, message: 'Error al guardar el post en el blog', error: error.message },
        { status: 500 }
      );
    }

    // Revalidate blog pages
    revalidatePath('/blog');
    revalidatePath(`/blog/${slug}`);

    return NextResponse.json({
      success: true,
      message: 'Post publicado exitosamente en el blog',
      post_id: data?.id,
      slug: data?.slug,
      url: `/blog/${slug}`,
    });
  } catch (err) {
    console.error('Blog ingest route error:', err);
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
