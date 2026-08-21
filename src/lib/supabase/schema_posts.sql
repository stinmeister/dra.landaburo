-- =============================================================================
-- Dra. Landaburo — Migraciones Fase 2
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Agregar rol 'cosmetologa' al CHECK de profiles
--    (requiere recrear el constraint porque PostgreSQL no permite ALTER CHECK)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'medico', 'operativo', 'cosmetologa', 'paciente'));

-- ---------------------------------------------------------------------------
-- 2. Agregar columnas faltantes a products (si no existen)
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS image_url     text,
  ADD COLUMN IF NOT EXISTS compare_price_ars numeric(12,2);

-- ---------------------------------------------------------------------------
-- 3. Tabla posts (CMS Blog)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id                 uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text        NOT NULL UNIQUE,
  title              text        NOT NULL,
  excerpt            text        NOT NULL DEFAULT '',
  content            text        NOT NULL DEFAULT '',
  cover_image_url    text,
  category           text        NOT NULL DEFAULT 'Dermatología',
  author_profile_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_published       boolean     NOT NULL DEFAULT false,
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_slug      ON public.posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_published ON public.posts(is_published, published_at DESC);

-- Trigger para updated_at automático
CREATE OR REPLACE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Lectura pública solo de posts publicados
CREATE POLICY posts_read_public ON public.posts
  FOR SELECT USING (is_published = true);

-- Admin puede leer/escribir todo (incluye borradores)
CREATE POLICY posts_admin_all ON public.posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
