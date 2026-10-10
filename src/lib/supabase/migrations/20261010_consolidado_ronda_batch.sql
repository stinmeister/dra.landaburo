-- =============================================================================
-- DDL CONSOLIDADO: RONDA BATCH DEL 10/10/2026
-- Consultorio Dra. Landaburo · Supabase producción: mdletvbgwzbpenzevurr
-- Ejecutable de una sola vez por Agustín en Supabase SQL Editor
--
-- Contenido consolidado:
-- 1. Columnas de Meta CAPI en `orders` (Trazabilidad y reintentos)
-- 2. Columna `attention_hours` en `store_config` (Desacople de pickup vs consultorio - FIX-068)
-- 3. Columna `allow_oversell_online` en `store_config` (Sobreventa condicionada)
-- 4. Tabla `mp_webhook_events` (Auditoría e idempotencia webhook Mercado Pago)
-- 5. Tabla `rate_limits` (Rate limiting persistente tras deploy - FIX-029)
-- 6. RLS en tablas de respaldo (Cierre de fuga anónima - FIX-080)
-- 7. Migración 20260929 limpia: RPC métricas ejecutivas, ON DELETE RESTRICT y política anon en leads (FIX-011)
-- 8. Consultas de verificación al pie
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. COLUMNAS DE META CAPI EN ORDERS
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS meta_capi_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS meta_capi_event_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_capi_error TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_capi_status ON public.orders(meta_capi_status);


-- -----------------------------------------------------------------------------
-- 2. DESACOPLE DE HORARIOS: ATTENTION_HOURS EN STORE_CONFIG (FIX-068)
-- -----------------------------------------------------------------------------
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS attention_hours TEXT DEFAULT 'Lun-Vier: 10:00 – 19:00 hs, Sáb: Solo con cita previa';


-- -----------------------------------------------------------------------------
-- 3. BANDERA DE SOBREVENTA CONDICIONADA EN STORE_CONFIG
-- -----------------------------------------------------------------------------
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS allow_oversell_online BOOLEAN DEFAULT false;


-- -----------------------------------------------------------------------------
-- 4. TABLA DE EVENTOS DE WEBHOOK DE MERCADO PAGO (AUDITORÍA E IDEMPOTENCIA)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  payment_id TEXT,
  status TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_mp_webhook_events_payment_id ON public.mp_webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_mp_webhook_events_processed_at ON public.mp_webhook_events(processed_at DESC);

ALTER TABLE public.mp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_webhook_events_service_role" ON public.mp_webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 5. RATE LIMITING PERSISTENTE (FIX-029)
-- Sobrevive a reinicios y reloads de PM2
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON public.rate_limits(reset_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits_service_role" ON public.rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 6. SELLADO RLS EN TABLAS DE RESPALDO (FIX-080)
-- Impide lectura de pacientes/cobros por la clave anon pública
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments_backup_20260916') THEN
    ALTER TABLE public.payments_backup_20260916 ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ingest_review_backup_20260916') THEN
    ALTER TABLE public.ingest_review_backup_20260916 ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 7. MIGRACIÓN LIMPIA: RPC MÉTRICAS, RESTRICT Y POLÍTICA ANON EN LEADS (FIX-011)
-- -----------------------------------------------------------------------------

-- 7.1 RPC obtener_metricas_ejecutivas
CREATE OR REPLACE FUNCTION public.obtener_metricas_ejecutivas(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_cosmetologa_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb;
  v_total_ars numeric := 0;
  v_total_usd numeric := 0;
  v_total_count int := 0;
  v_by_method jsonb := '{}'::jsonb;
  v_cosmetologa_total numeric := 0;
BEGIN
  -- Guard estricto de autorización RBAC
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'medico')
  ) THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin o medico' USING ERRCODE = '42501';
  END IF;

  -- 1. Totales generales vigentes (excluyendo superseded_by)
  SELECT
    COALESCE(SUM(amount_ars), 0),
    COALESCE(SUM(amount_usd), 0),
    COUNT(*)
  INTO
    v_total_ars,
    v_total_usd,
    v_total_count
  FROM public.payments
  WHERE payment_date >= p_start_date
    AND payment_date < p_end_date
    AND superseded_by IS NULL;

  -- 2. Desglose por medio de pago vigente
  SELECT jsonb_object_agg(payment_method, total)
  INTO v_by_method
  FROM (
    SELECT payment_method, COALESCE(SUM(amount_ars), 0) AS total
    FROM public.payments
    WHERE payment_date >= p_start_date
      AND payment_date < p_end_date
      AND superseded_by IS NULL
    GROUP BY payment_method
  ) sub;

  -- 3. Métricas de profesional cosmetología parametrizada
  IF p_cosmetologa_profile_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount_ars), 0)
    INTO v_cosmetologa_total
    FROM public.payments
    WHERE payment_date >= p_start_date
      AND payment_date < p_end_date
      AND superseded_by IS NULL
      AND professional_profile_id = p_cosmetologa_profile_id;
  END IF;

  -- JSON consolidado
  v_result := jsonb_build_object(
    'total_ars', v_total_ars,
    'total_usd', v_total_usd,
    'total_count', v_total_count,
    'by_method', COALESCE(v_by_method, '{}'::jsonb),
    'cosmetologa_total_ars', v_cosmetologa_total,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'calculated_at', now()
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_metricas_ejecutivas(timestamptz, timestamptz, uuid) TO authenticated;

-- 7.2 ON DELETE RESTRICT en stock_movements
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stock_movements_product_id_fkey'
      AND table_name = 'stock_movements'
  ) THEN
    ALTER TABLE public.stock_movements DROP CONSTRAINT stock_movements_product_id_fkey;
  END IF;

  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE RESTRICT;
END $$;

-- 7.3 Política anon en leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads' AND policyname = 'Permitir inserción de leads a usuarios anónimos'
  ) THEN
    CREATE POLICY "Permitir inserción de leads a usuarios anónimos"
    ON public.leads
    FOR INSERT
    TO anon
    WITH CHECK (
      full_name IS NOT NULL AND
      email IS NOT NULL AND
      status = 'nuevo'
    );
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- CONSULTAS DE VERIFICACIÓN (Ejecutar en SQL Editor tras la migración)
-- =============================================================================

-- 1. Verificar columnas de CAPI y horarios
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name LIKE 'meta_capi_%'
UNION ALL
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'store_config' AND column_name IN ('attention_hours', 'allow_oversell_online');

-- 2. Verificar que las tablas de respaldo tienen RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('payments_backup_20260916', 'ingest_review_backup_20260916');

-- 3. Verificar triggers de deletion_audit (Pregunta Sí/No)
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'deletion_audit';
