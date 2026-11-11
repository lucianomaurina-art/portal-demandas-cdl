begin;

create table public.purchase_requests (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  requester text not null check (char_length(btrim(requester)) between 1 and 120),
  purpose text not null check (char_length(btrim(purpose)) between 1 and 600),
  registered_name text not null,
  demand_id uuid references public.demands(id) on delete restrict,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  linked_by uuid,
  linked_at timestamptz
);

create index purchase_requests_demand_idx on public.purchase_requests (demand_id, id);

alter table public.purchase_requests enable row level security;
revoke all on public.purchase_requests from public, anon, authenticated;
grant select (id, title, requester, purpose, registered_name, demand_id, created_at) on public.purchase_requests to authenticated;
grant insert (title, requester, purpose, demand_id) on public.purchase_requests to authenticated;
grant update (demand_id) on public.purchase_requests to authenticated;

create policy purchase_requests_read on public.purchase_requests
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active)
  and (demand_id is null or exists (select 1 from public.demands d where d.id = demand_id))
);

create policy purchase_requests_create on public.purchase_requests
for insert to authenticated with check (
  created_by = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active)
);

create policy purchase_requests_link on public.purchase_requests
for update to authenticated
using (
  demand_id is null
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active)
)
with check (
  demand_id is not null
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active)
);

create function public.validate_purchase_request_link() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select coalesce(nullif(btrim(p.name),''),nullif(btrim(p.email),''),'Usuário interno') into new.registered_name
    from public.profiles p where p.id = auth.uid() and p.active;
    if not found then
      raise exception 'É necessário um perfil interno ativo.' using errcode = '42501';
    end if;
  end if;
  if new.demand_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.demands d where d.id = new.demand_id and d.active
  ) or (
    select decision from public.demand_purchase_decisions
    where demand_id = new.demand_id order by id desc limit 1
  ) is distinct from 'yes' then
    raise exception 'A demanda precisa estar ativa e marcada como Envolve compra.'
      using errcode = '23514';
  end if;
  new.linked_by := auth.uid();
  new.linked_at := now();
  return new;
end;
$$;
revoke all on function public.validate_purchase_request_link() from public, anon, authenticated;

create trigger purchase_requests_validate_link
before insert or update of demand_id on public.purchase_requests
for each row execute function public.validate_purchase_request_link();

commit;
