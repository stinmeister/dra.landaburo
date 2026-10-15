-- =============================================================================
-- Migración Propuesta: 20261015_ingest_runs_rpc.sql
-- Consultorio Dra. Landaburo · 15/10/2026
-- Propuesta para ejecución por Agustín Landaburo
-- =============================================================================

-- RPC con guard de rol RBAC para lectura de ingest_runs por administradores
CREATE OR REPLACE FUNCTION public.obtener_ultimo_ingest_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_result jsonb;
BEGIN
  -- 1. Verificar rol admin del usuario autenticado en auth.uid()
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role != 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin' USING ERRCODE = '42501';
  END IF;

  -- 2. Retornar la última corrida de ingest_runs
  SELECT to_jsonb(r) INTO v_result
    FROM ingest_runs r
   ORDER BY started_at DESC
   LIMIT 1;

  RETURN v_result;
END;
$$;
