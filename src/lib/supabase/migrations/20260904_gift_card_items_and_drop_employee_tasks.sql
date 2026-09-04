-- =============================================================================
-- MIGRACIÓN 04/09/2026 — Gift Cards Combinables y Depuración de Tablas
-- Ejecutar en Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mdletvbgwzbpenzevurr/sql
-- =============================================================================

-- 1. DROP TABLE employee_tasks (Aprobado: 0 filas, staff_tasks es la canónica)
DROP TABLE IF EXISTS public.employee_tasks CASCADE;

-- 2. TABLA gift_card_items (Soporte para múltiples tratamientos, productos y monto libre en una sola Gift Card)
CREATE TABLE IF NOT EXISTS public.gift_card_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id        UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  item_type           TEXT NOT NULL CHECK (item_type IN ('treatment', 'product', 'custom_amount')),
  treatment_id        UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  product_id          UUID REFERENCES public.products(id) ON DELETE SET NULL,
  custom_amount_ars   NUMERIC(12,2),
  unit_price_ars      NUMERIC(12,2) NOT NULL,
  quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal_ars        NUMERIC(12,2) NOT NULL,
  item_title          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_card_items_card_id ON public.gift_card_items(gift_card_id);

ALTER TABLE public.gift_card_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY gift_card_items_admin_all ON public.gift_card_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY gift_card_items_public_insert ON public.gift_card_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY gift_card_items_public_read ON public.gift_card_items
  FOR SELECT USING (true);

-- 3. TABLA app_settings (Para configuración operativa y tokens si no existe)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_access_token           TEXT,
  mp_public_key             TEXT,
  default_birthday_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  default_giftcard_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_settings_admin_all ON public.app_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY app_settings_read_auth ON public.app_settings
  FOR SELECT USING (auth.role() = 'authenticated');
