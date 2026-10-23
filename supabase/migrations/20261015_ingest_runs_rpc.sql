-- RPC de última corrida de ingesta — 23/10/2026 · mdletvbgwzbpenzevurr
-- Correr PASO 0 primero y mirar la salida antes de seguir.


-- PASO 0 · Medir antes de crear ------------------------------------------------
-- La función propuesta compara `role != 'admin'`. Si el valor guardado en
-- profiles.role no es exactamente 'admin', la función deniega a TODOS —incluido
-- vos— y el dashboard queda vacío sin dar error. Esto lo zanja.

select 'roles en profiles' as objeto,
       coalesce(string_agg(distinct role, ' · ' order by role), '(vacío)') as detalle
  from public.profiles
union all
select 'cuántos admin hay',
       count(*)::text
  from public.profiles
 where role = 'admin'
union all
select 'funciones de rol existentes',
       coalesce(string_agg(routine_name, ' · ' order by routine_name), '❌ ninguna')
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('is_admin','is_staff','is_internal_staff')
union all
select 'cuerpo de is_admin',
       coalesce((select pg_get_functiondef(oid)
                   from pg_proc
                  where pronamespace = 'public'::regnamespace
                    and proname = 'is_admin'
                  limit 1), '❌ no existe');

-- 👉 Si "roles en profiles" NO incluye 'admin', o si "cuántos admin hay" da 0,
--    PARÁ y pegame la salida. No corras el PASO 1.


-- PASO 1 · La función ----------------------------------------------------------
-- Usa public.is_admin() en vez de comparar el literal, para que la guarda sea
-- la misma que usa el resto de la aplicación y no una copia que puede divergir.

create or replace function public.obtener_ultimo_ingest_run()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Acceso denegado: se requiere rol admin' using errcode = '42501';
  end if;

  select to_jsonb(r) into v_result
    from public.ingest_runs r
   order by r.started_at desc
   limit 1;

  return v_result;   -- NULL si todavía no hay corridas. Ver nota al pie.
end;
$$;

grant execute on function public.obtener_ultimo_ingest_run() to authenticated;

notify pgrst, 'reload schema';


-- PASO 2 · Verificación ---------------------------------------------------------

select 'función creada' as objeto,
       case when exists (select 1 from information_schema.routines
                          where routine_schema='public'
                            and routine_name='obtener_ultimo_ingest_run')
            then '✅' else '❌' end as estado
union all
select 'permisos otorgados',
       coalesce((select string_agg(grantee, ', ' order by grantee)
                   from information_schema.role_routine_grants
                  where routine_schema='public'
                    and routine_name='obtener_ultimo_ingest_run'
                    and privilege_type='EXECUTE'), '❌ ninguno')
union all
select 'filas en ingest_runs',
       (select count(*)::text from public.ingest_runs);

-- Y probala como vos mismo:
select public.obtener_ultimo_ingest_run();

-- NOTA PARA EL LADO WEB ---------------------------------------------------------
-- `ingest_runs` tiene 0 filas hoy, así que la RPC devuelve NULL hasta la primera
-- corrida real. El dashboard tiene que distinguir TRES estados y no colapsarlos:
--
--   NULL            → "todavía no se corrió ninguna ingesta"
--   fila + status   → el resumen de la corrida
--   error 42501     → no sos admin
-- =============================================================================
