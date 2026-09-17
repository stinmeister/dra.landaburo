-- ==============================================================================
-- SCRIPT DE PURGA DE COBROS HISTÓRICOS Y AUDITORÍA PRE-CORTE
-- Proyecto: dralandaburo.com (Supabase / PostgreSQL)
-- Fecha: 16/09/2026
-- ==============================================================================
--
-- CONTEXTO Y DIAGNÓSTICO DE BASE DE DATOS:
-- Actualmente la tabla 'payments' tiene 1.072 cobros totales:
--   • 708 cobros históricos de pruebas (Julio 2025 a Junio 2026) que suman $68.962.894 ARS.
--   • 364 cobros oficiales de la clínica a partir del 1 de Julio de 2026:
--       - Julio 2026: 81 cobros ($14.148.600)
--       - Agosto 2026: 172 cobros ($28.066.300)
--       - Septiembre 2026: 111 cobros ($17.643.500)
--
-- Además, en 'ingest_review' existen 228 registros de auditoría de fechas anteriores a Julio 2026.
--
-- La API de ingesta (/api/ingest/payments) ya tiene activo el filtro PAYMENTS_CUTOFF_DATE,
-- por lo que estos registros purgados NUNCA se volverán a reingresar automáticamente.
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- PASO 0: DIAGNÓSTICO Y SIMULACIÓN PREVIA (SOLO LECTURA - NO MODIFICA DATOS)
-- Ejecutar este bloque en el SQL Editor de Supabase para ver qué se purgará.
-- ------------------------------------------------------------------------------
SELECT 
    to_char(payment_date, 'YYYY-MM') AS periodo,
    COUNT(*) AS cantidad_cobros,
    SUM(COALESCE(amount_ars, 0)) AS total_facturado_ars,
    COUNT(*) FILTER (WHERE amount_ars = 0) AS cobros_en_cero,
    CASE 
        WHEN payment_date < '2026-07-01T00:00:00-03:00' THEN '🔴 HISTÓRICO / PRUEBAS (A PURGAR)'
        ELSE '🟢 OFICIAL CLÍNICA (CONSERVAR)'
    END AS clasificacion
FROM public.payments
GROUP BY to_char(payment_date, 'YYYY-MM'), 
         (payment_date < '2026-07-01T00:00:00-03:00')
ORDER BY periodo ASC;


-- ------------------------------------------------------------------------------
-- PASO 1: RESPALDO PREVENTIVO AUTOMÁTICO (SEGURIDAD TOTAL)
-- Crea una copia de seguridad exacta en la misma base antes de tocar nada.
-- Si hiciera falta restaurar, la tabla de respaldo queda lista y accesible.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments_backup_20260916 AS 
SELECT * FROM public.payments;

CREATE TABLE IF NOT EXISTS public.ingest_review_backup_20260916 AS 
SELECT * FROM public.ingest_review;


-- ------------------------------------------------------------------------------
-- PASO 2: PURGA HISTÓRICA TRANSACCIONAL (BEGIN ... COMMIT)
-- Fecha de corte predeterminada: 1 de Julio de 2026 ('2026-07-01T00:00:00-03:00')
-- 
-- NOTA: Si se decidiera tomar como fecha de corte el 1 de Agosto de 2026,
-- cambiar '2026-07-01T00:00:00-03:00' por '2026-08-01T00:00:00-03:00'.
-- ------------------------------------------------------------------------------
BEGIN;

-- 2.1 Eliminar cobros anteriores a la fecha de corte en 'payments'
DELETE FROM public.payments
WHERE payment_date < '2026-07-01T00:00:00-03:00';

-- 2.2 Limpiar registros de revisión de cobros anteriores a la fecha de corte
DELETE FROM public.ingest_review
WHERE source = 'payments'
  AND (
      created_at < '2026-07-01T00:00:00-03:00'
      OR payload->>'fecha' LIKE '%/2025%' 
      OR payload->>'fecha' LIKE '%-2025%'
      OR payload->>'fecha' LIKE '%/01/2026'
      OR payload->>'fecha' LIKE '%/02/2026'
      OR payload->>'fecha' LIKE '%/03/2026'
      OR payload->>'fecha' LIKE '%/04/2026'
      OR payload->>'fecha' LIKE '%/05/2026'
      OR payload->>'fecha' LIKE '%/06/2026'
  );

COMMIT;


-- ------------------------------------------------------------------------------
-- PASO 3: VERIFICACIÓN POST-PURGA
-- Ejecutar para constatar los cobros y totales consolidados oficiales.
-- ------------------------------------------------------------------------------
-- 3.1 Cobros oficiales conservados por mes (Julio, Agosto y Septiembre 2026):
SELECT 
    to_char(payment_date, 'YYYY-MM') AS periodo,
    COUNT(*) AS cantidad_cobros,
    SUM(COALESCE(amount_ars, 0)) AS total_facturado_ars
FROM public.payments
GROUP BY to_char(payment_date, 'YYYY-MM')
ORDER BY periodo ASC;

-- 3.2 Totales generales consolidados:
SELECT 
    COUNT(*) AS total_cobros_activos,
    MIN(payment_date) AS cobro_mas_antiguo,
    MAX(payment_date) AS cobro_mas_reciente,
    SUM(amount_ars) AS facturacion_total_activa_ars
FROM public.payments;

-- 3.3 Auditoría de revisiones restantes en /dashboard/revision:
SELECT 
    source, 
    status, 
    COUNT(*) AS cantidad
FROM public.ingest_review 
GROUP BY source, status
ORDER BY source, status;
