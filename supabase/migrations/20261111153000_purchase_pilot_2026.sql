begin;

create table public.purchase_cost_centers (
  code text primary key,
  name text not null
);
insert into public.purchase_cost_centers(code,name)
select distinct on (code) code,name
from public.obz_centers
order by code,fiscal_year desc;

alter table public.purchase_cost_centers enable row level security;
revoke all on public.purchase_cost_centers from public, anon, authenticated;
grant select on public.purchase_cost_centers to authenticated;
create policy purchase_centers_read on public.purchase_cost_centers for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));

alter table public.purchase_requests
  add column status text not null default 'draft' check (status in ('draft','submitted','triaged','returned','rejected')),
  add column decision_note text,
  add column status_changed_at timestamptz;
grant select (status,decision_note,status_changed_at,created_by) on public.purchase_requests to authenticated;
grant update (status,decision_note) on public.purchase_requests to authenticated;
create policy purchase_requests_transition on public.purchase_requests for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));

-- The new UPDATE policy also applies to the already-granted demand_id column.
-- Enforce write-once linkage at the row level as well.
create function cdl_purchase_private.guard_pilot_request_update() returns trigger
language plpgsql security definer set search_path=''
as $$
declare profile_role text; profile_id uuid := auth.uid();
begin
  select p.role into profile_role from public.profiles p where p.id=profile_id and p.active;
  if not found then raise exception 'Perfil interno ativo obrigatório.' using errcode='42501'; end if;
  if old.demand_id is not null and new.demand_id is distinct from old.demand_id then
    raise exception 'A demanda de origem já foi vinculada.' using errcode='23514';
  end if;
  if new.status is not distinct from old.status then
    if new.decision_note is distinct from old.decision_note then
      raise exception 'Registre o parecer em uma mudança de etapa.';
    end if;
    return new;
  end if;
  if new.status='submitted' and old.status in ('draft','returned') then
    if old.created_by<>profile_id and profile_role<>'admin' then
      raise exception 'Envio restrito ao registrante ou administrador.' using errcode='42501';
    end if;
    if not exists(select 1 from public.purchase_request_items i where i.request_id=old.id) then
      raise exception 'Adicione pelo menos um item antes de enviar.';
    end if;
    new.decision_note := null;
  elsif old.status='submitted' and new.status in ('triaged','returned','rejected') then
    if profile_role<>'admin' then
      raise exception 'Triagem restrita ao administrador.' using errcode='42501';
    end if;
    if coalesce(char_length(btrim(new.decision_note)),0) not between 1 and 600 then
      raise exception 'Informe o parecer da triagem.';
    end if;
    new.decision_note := btrim(new.decision_note);
  else
    raise exception 'Mudança de etapa inválida.';
  end if;
  new.status_changed_at := now();
  return new;
end;
$$;
revoke all on function cdl_purchase_private.guard_pilot_request_update() from public,anon,authenticated;
create trigger purchase_request_pilot_transition before update on public.purchase_requests
for each row execute function cdl_purchase_private.guard_pilot_request_update();

alter table public.purchase_request_items
  alter column publication_id drop not null,
  alter column obz_line_id drop not null,
  add column center_code text references public.purchase_cost_centers(code),
  add column nature text not null default 'material' check (nature in ('material','service')),
  add constraint purchase_item_funding_check check (
    (publication_id is not null and obz_line_id is not null and center_code is null)
    or (publication_id is null and obz_line_id is null and center_code is not null and extract(year from needed_on)=2026)
  );
grant select (center_code,nature) on public.purchase_request_items to authenticated;
grant insert (center_code,nature) on public.purchase_request_items to authenticated;
grant delete on public.purchase_request_items to authenticated;
create policy purchase_items_delete_draft on public.purchase_request_items for delete to authenticated
using (exists (select 1 from public.purchase_requests p where p.id=request_id));

create function cdl_purchase_private.guard_pilot_items() returns trigger
language plpgsql security definer set search_path=''
as $$
declare request_key bigint; owner_id uuid; request_status text; profile_role text;
begin
  select p.role into profile_role from public.profiles p where p.id=auth.uid() and p.active;
  if not found then raise exception 'Perfil interno ativo obrigatório.' using errcode='42501'; end if;
  request_key := case when tg_op='DELETE' then old.request_id else new.request_id end;
  select r.created_by,r.status into owner_id,request_status
  from public.purchase_requests r where r.id=request_key for update;
  if not found or (owner_id<>auth.uid() and profile_role<>'admin') then
    raise exception 'Edição restrita ao registrante ou administrador.' using errcode='42501';
  end if;
  if request_status not in ('draft','returned') then
    raise exception 'A solicitação já foi enviada para triagem.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function cdl_purchase_private.guard_pilot_items() from public,anon,authenticated;
create trigger purchase_item_guard_pilot before insert or delete on public.purchase_request_items
for each row execute function cdl_purchase_private.guard_pilot_items();

drop trigger purchase_item_check_budget on public.purchase_request_items;
create trigger purchase_item_check_budget before insert on public.purchase_request_items
for each row when (new.publication_id is not null)
execute function cdl_purchase_private.validate_item_budget();

notify pgrst, 'reload schema';
commit;
