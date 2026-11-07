-- ============================================================================
-- MIGRACIÓN PENDIENTE DE REVISIÓN (DDL LISTO PARA REVISIÓN — NO EJECUTADO)
-- Fecha: 2026-11-07
-- Cubre:
--   1. Ítem 5.b: Créditos por categoría para tratamientos médicos (Dra. Landaburo)
--                + tabla de detalle `gift_card_items` con RLS segura.
--   2. Ítem 6.5: Registro inmutable en base de datos `price_sync_audit` para
--                sincronización diaria de precios desde Google Sheets.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ÍTEM 5.b · Categorías de crédito médico para Gift Cards (solo Admin)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gift_card_credit_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  credit_amount_ars numeric(12, 2) CHECK (credit_amount_ars IS NULL OR credit_amount_ars > 0),
  disclaimer_text text NOT NULL DEFAULT 'Sujeto a evaluación médica. Si el tratamiento no está indicado, el crédito se usa en otro tratamiento del consultorio.',
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.gift_card_credit_categories ENABLE ROW LEVEL SECURITY;

-- Lectura pública: únicamente categorías activas que ya tengan monto válido (> 0) definido por Admin.
-- Mientras credit_amount_ars sea NULL, la categoría NO se expone públicamente.
DROP POLICY IF EXISTS "Public read valid gift_card_credit_categories" ON public.gift_card_credit_categories;
CREATE POLICY "Public read valid gift_card_credit_categories"
  ON public.gift_card_credit_categories
  FOR SELECT
  USING (is_active = true AND credit_amount_ars IS NOT NULL AND credit_amount_ars > 0);

-- Gestión completa (lectura de borradores sin monto + alta/edición/pausa): exclusivamente rol 'admin'.
DROP POLICY IF EXISTS "Admin full access gift_card_credit_categories" ON public.gift_card_credit_categories;
CREATE POLICY "Admin full access gift_card_credit_categories"
  ON public.gift_card_credit_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Pre-carga de las 8 categorías sugeridas desde la pestaña "Tratamientos Pau" SIN MONTO (NULL).
-- Al tener credit_amount_ars = NULL, la sección pública no aparece hasta que Agustín defina los montos en el panel.
INSERT INTO public.gift_card_credit_categories (slug, name, credit_amount_ars, sort_order, is_active)
VALUES
  ('toxina-botulinica',          'Toxina botulínica',            NULL, 10, true),
  ('acido-hialuronico-rellenos', 'Ácido hialurónico / rellenos', NULL, 20, true),
  ('bioestimuladores',           'Bioestimuladores',             NULL, 30, true),
  ('hilos-tensores',             'Hilos tensores',               NULL, 40, true),
  ('plasma-rico-en-plaquetas',   'Plasma rico en plaquetas',     NULL, 50, true),
  ('mesoterapia',                'Mesoterapia',                  NULL, 60, true),
  ('laser-nordlys',              'Láser Nordlys',                NULL, 70, true),
  ('tratamientos-perioculares',  'Tratamientos perioculares',    NULL, 80, true)
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. ÍTEM 5.b · Tabla de ítems de Gift Card (`gift_card_items`)
--    Hoy NO existe en producción y es necesaria para persistir tanto combos
--    como ítems de tipo "Crédito <Categoría> — $X" en voucher, mail y panel.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gift_card_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('treatment', 'product', 'medical_credit', 'custom_amount')),
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  credit_category_id uuid REFERENCES public.gift_card_credit_categories(id) ON DELETE RESTRICT,
  custom_amount_ars numeric(12, 2) CHECK (custom_amount_ars IS NULL OR custom_amount_ars > 0),
  unit_price_ars numeric(12, 2) NOT NULL CHECK (unit_price_ars > 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_card_items_gift_card_id
  ON public.gift_card_items(gift_card_id);

ALTER TABLE public.gift_card_items ENABLE ROW LEVEL SECURITY;

-- Solo staff autorizado (admin y operativo) lee ítems desde sesión autenticada;
-- la inserción en checkout y la consulta pública por código corren en servidor con service_role.
DROP POLICY IF EXISTS "Staff read gift_card_items" ON public.gift_card_items;
CREATE POLICY "Staff read gift_card_items"
  ON public.gift_card_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'operativo')
    )
  );

-- ----------------------------------------------------------------------------
-- 3. ÍTEM 6.5 · Registro inmutable de cambios de precio (`price_sync_audit`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_sync_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  entity_type text NOT NULL CHECK (entity_type IN ('product', 'cosmetology_treatment')),
  entity_id uuid NOT NULL,
  codigo_web text NOT NULL,
  entity_name text NOT NULL,
  old_price_ars numeric(12, 2),
  new_price_ars numeric(12, 2) NOT NULL CHECK (new_price_ars > 0),
  pct_change numeric(8, 2),
  sheet_tab text NOT NULL,
  sheet_row integer NOT NULL,
  source_raw_value text
);

CREATE INDEX IF NOT EXISTS idx_price_sync_audit_occurred_at
  ON public.price_sync_audit(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_sync_audit_entity
  ON public.price_sync_audit(entity_type, entity_id);

ALTER TABLE public.price_sync_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read price_sync_audit" ON public.price_sync_audit;
CREATE POLICY "Admin read price_sync_audit"
  ON public.price_sync_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Inmutabilidad estricta (no permite UPDATE ni DELETE), reutilizando o creando función de bloqueo
CREATE OR REPLACE FUNCTION public.prevent_immutable_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'La tabla de auditoría % es inmutable: no se permite %', TG_TABLE_NAME, TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_sync_audit_immutable ON public.price_sync_audit;
CREATE TRIGGER trg_price_sync_audit_immutable
  BEFORE UPDATE OR DELETE ON public.price_sync_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_immutable_audit_mutation();

COMMIT;
