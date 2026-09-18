-- =============================================================================
-- MIGRACIÓN 20/09/2026 — Gestión de Productos: Stock, Categorías y Catálogo
-- Proyecto: dralandaburo.com · Solicita: Agustín Landaburo
-- Ejecutar en Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mdletvbgwzbpenzevurr/sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLA: product_categories (Categorías Dinámicas Administrables)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON public.product_categories(slug);
CREATE INDEX IF NOT EXISTS idx_product_categories_active ON public.product_categories(is_active);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_categories_read_public') THEN
    CREATE POLICY product_categories_read_public ON public.product_categories
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_categories_write_staff') THEN
    CREATE POLICY product_categories_write_staff ON public.product_categories
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('admin', 'operativo')
        )
      );
  END IF;
END $$;

-- Semilla inicial: las 9 categorías reales que ya tienen los 31 productos cargados
INSERT INTO public.product_categories (name, slug, display_order, is_active)
VALUES
  ('Limpieza', 'limpieza', 1, true),
  ('Hidratación', 'hidratacion', 2, true),
  ('Protección solar', 'proteccion-solar', 3, true),
  ('Sérum', 'serum', 4, true),
  ('Contorno de ojos', 'contorno-de-ojos', 5, true),
  ('Tratamiento específico', 'tratamiento-especifico', 6, true),
  ('Acné', 'acne', 7, true),
  ('Rosácea', 'rosacea', 8, true),
  ('Post-tratamiento', 'post-tratamiento', 9, true)
ON CONFLICT (name) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. MODIFICACIONES EN TABLA: products
-- -----------------------------------------------------------------------------
-- Flag para distinguir productos públicos (tienda web) de productos internos (consultorio/mostrador)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- Flexibilizar precio para permitir pre-carga de productos en relevamiento sin inventar valores
ALTER TABLE public.products ALTER COLUMN price_ars DROP NOT NULL;

-- Flexibilizar categoría si aún no fue asignada
ALTER TABLE public.products ALTER COLUMN category DROP NOT NULL;

-- Índice para filtrado de catálogo público
CREATE INDEX IF NOT EXISTS idx_products_is_public ON public.products(is_public) WHERE is_public = true;


-- -----------------------------------------------------------------------------
-- 3. TABLA: stock_movements (Historial de Stock con Auditoría Inmutable)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  previous_stock  INTEGER NOT NULL,
  new_stock       INTEGER NOT NULL,
  quantity_delta  INTEGER NOT NULL,
  movement_type   TEXT NOT NULL CHECK (
    movement_type IN ('recuento_fisico', 'reposicion', 'venta', 'ajuste_diferencia', 'baja')
  ),
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_date
  ON public.stock_movements(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_date
  ON public.stock_movements(created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'stock_movements_read_staff') THEN
    CREATE POLICY stock_movements_read_staff ON public.stock_movements
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('admin', 'operativo', 'cosmetologa', 'medico')
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'stock_movements_insert_staff') THEN
    CREATE POLICY stock_movements_insert_staff ON public.stock_movements
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('admin', 'operativo', 'cosmetologa', 'medico')
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. INMUTABILIDAD ESTRICTA DEL HISTORIAL (No permite UPDATE ni DELETE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_stock_movement_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de stock_movements son inmutables para garantizar auditoría. Si hubo un error, registre un nuevo movimiento correctivo.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movements_prevent_mutation ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_prevent_mutation
BEFORE UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.prevent_stock_movement_mutation();


-- -----------------------------------------------------------------------------
-- 5. RECORDATORIO: ALTER PENDIENTE DE INGEST_REVIEW (Del prompt anterior)
-- -----------------------------------------------------------------------------
ALTER TABLE public.ingest_review 
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;
