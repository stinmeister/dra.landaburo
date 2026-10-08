-- =============================================================================
-- DDL del 07/10/2026 — Auditoría de eliminaciones
-- Consultorio Dra. Landaburo · Supabase producción: mdletvbgwzbpenzevurr
-- Lo ejecuta: Agustín, en el SQL Editor
--
-- URGENTE: la eliminación de productos y tratamientos YA ESTÁ EN PRODUCCIÓN
-- (commit f45588a) y hoy el único registro de un borrado es un log de consola
-- que rota. Esto cierra esa ventana.
-- =============================================================================

begin;

create table if not exists public.deletion_audit (
  id            uuid primary key default gen_random_uuid(),
  occurred_at   timestamptz not null default now(),

  -- Quién. El id puede quedar en null si la persona se da de baja;
  -- el nombre NO, porque es el dato que importa dentro de dos años.
  actor_id      uuid references public.profiles(id) on delete set null,
  actor_name    text not null,

  -- Qué
  action        text not null check (action in ('eliminado','archivado','restaurado')),
  entity_type   text not null check (entity_type in ('producto','tratamiento','material','campana','lead','gift_card')),
  entity_id     text not null,
  entity_name   text not null,

  -- Contexto: la fila completa antes de desaparecer, el motivo, lo que haga falta
  reason        text,
  snapshot      jsonb not null default '{}'::jsonb
);

create index if not exists idx_deletion_audit_entity
  on public.deletion_audit(entity_type, entity_id);

create index if not exists idx_deletion_audit_fecha
  on public.deletion_audit(occurred_at desc);

comment on table public.deletion_audit is
  'Registro inmutable de eliminaciones y archivados. No se edita ni se borra.';

commit;


-- ---------------------------------------------------------------------------
-- Inmutabilidad — mismo patrón que stock_movements
-- ---------------------------------------------------------------------------

begin;

create or replace function public.prevent_deletion_audit_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'deletion_audit es inmutable: no se puede modificar ni borrar (id %)', old.id;
end;
$$;

drop trigger if exists trg_deletion_audit_no_update on public.deletion_audit;
create trigger trg_deletion_audit_no_update
  before update on public.deletion_audit
  for each row execute function public.prevent_deletion_audit_change();

drop trigger if exists trg_deletion_audit_no_delete on public.deletion_audit;
create trigger trg_deletion_audit_no_delete
  before delete on public.deletion_audit
  for each row execute function public.prevent_deletion_audit_change();

commit;


-- ---------------------------------------------------------------------------
-- RLS: lee el admin, escribe el admin, nadie edita ni borra
-- ---------------------------------------------------------------------------

begin;

alter table public.deletion_audit enable row level security;

drop policy if exists "admin_lee_auditoria" on public.deletion_audit;
create policy "admin_lee_auditoria" on public.deletion_audit
  for select
  using ( exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') );

drop policy if exists "admin_escribe_auditoria" on public.deletion_audit;
create policy "admin_escribe_auditoria" on public.deletion_audit
  for insert
  with check ( exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') );

-- Sin policies de UPDATE ni DELETE: quedan denegadas. Y aunque algo pasara por
-- service_role y saltara RLS, los triggers de arriba lo frenan igual.

commit;
