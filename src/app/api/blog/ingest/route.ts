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
      subtitle,
      category,
      author_name = 'Dra. Paula Landaburo',
      author_role = 'Médica Especialista en Medicina Estética & Dermatología',
      author_image = '/images/Dra.Landaburo.png',
      read_time_minutes = 5,
      hero_image,
      before_after_image,
      excerpt,
      content_markdown,
      sections = [],
      faqs = [],
      seo_title,
      seo_description,
      seo_keywords = [],
      published_at,
      is_published = true,
    } = body;

    if (!slug || !title || !category || !excerpt || !content_markdown) {
      return NextResponse.json(
        {
          success: false,
          message: 'Faltan campos requeridos: slug, title, category, excerpt, content_markdown',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('articles')
      .upsert(
        {
          slug,
          title,
          subtitle: subtitle || null,
          category,
          author_name,
          author_role,
          author_image,
          read_time_minutes,
          hero_image: hero_image || null,
          before_after_image: before_after_image || null,
          excerpt,
          content_markdown,
          sections,
          faqs,
          seo_title: seo_title || title,
          seo_description: seo_description || excerpt,
          seo_keywords,
          published_at: published_at || new Date().toISOString(),
          is_published,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' }
      )
      .select('id, slug')
      .single();

    if (error) {
      console.error('Blog ingest error:', error);
      return NextResponse.json(
        { success: false, message: 'Error al guardar el artículo', error: error.message },
        { status: 500 }
      );
    }

    // Revalidate blog pages
    revalidatePath('/blog');
    revalidatePath(`/blog/${slug}`);

    return NextResponse.json({
      success: true,
      message: 'Artículo publicado exitosamente',
      article_id: data?.id,
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
