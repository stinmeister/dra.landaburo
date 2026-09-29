-- ==============================================================================
-- MIGRACIÓN DDL: 29/09/2026
-- 1. RPC obtener_metricas_ejecutivas (Seguridad RLS + Parametrizada)
-- 2. Restricción ON DELETE RESTRICT en stock_movements (Baja Lógica Inmutable)
-- 3. Política RLS anon en leads (Desacople de Service Role en Contacto Público)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC obtener_metricas_ejecutivas
-- ------------------------------------------------------------------------------
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
  v_caller_role text;
  v_result jsonb;
  v_total_ars numeric := 0;
  v_total_usd numeric := 0;
  v_total_count int := 0;
  v_by_method jsonb := '{}'::jsonb;
  v_cosmetologa_total numeric := 0;
BEGIN
  -- Bloque 0.2: Guard de autorización estricto
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

  -- 3. Métricas de cosmetóloga parametrizada (Bloque 0.3)
  IF p_cosmetologa_profile_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount_ars), 0)
    INTO v_cosmetologa_total
    FROM public.payments
    WHERE payment_date >= p_start_date
      AND payment_date < p_end_date
      AND superseded_by IS NULL
      AND professional_profile_id = p_cosmetologa_profile_id;
  END IF;

  -- Construir respuesta JSON consolidada
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

-- Otorgar permiso de ejecución a usuarios autenticados (el guard interno valida el rol)
GRANT EXECUTE ON FUNCTION public.obtener_metricas_ejecutivas(timestamptz, timestamptz, uuid) TO authenticated;


-- ------------------------------------------------------------------------------
-- 2. Restricción ON DELETE RESTRICT en stock_movements (Baja Lógica)
-- ------------------------------------------------------------------------------
-- Impide que cualquier producto con histórico de stock sea eliminado físicamente de la base de datos.
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


-- ------------------------------------------------------------------------------
-- 3. Política RLS anon en leads (Contacto Público sin service_role)
-- ------------------------------------------------------------------------------
-- Permite que el formulario público inserte leads directamente con la clave anónima bajo validación estricta.
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
