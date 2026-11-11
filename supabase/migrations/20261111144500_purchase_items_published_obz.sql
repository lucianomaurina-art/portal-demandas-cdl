begin;

create schema if not exists cdl_purchase_private;

create table public.purchase_budget_publications (
  id bigint generated always as identity primary key,
  center_id uuid not null references public.obz_centers(id) on delete restrict,
  center_code text not null,
  center_name text not null,
  fiscal_year integer not null,
  published_at timestamptz not null,
  published_by uuid not null
);

create index purchase_budget_publications_center_idx
  on public.purchase_budget_publications(center_id, published_at desc, id desc);

create table public.purchase_budget_lines (
  publication_id bigint not null references public.purchase_budget_publications(id) on delete restrict,
  obz_line_id uuid not null,
  description text not null,
  account_code text,
  approved_amount numeric(14,2) not null check (approved_amount > 0),
  primary key(publication_id, obz_line_id)
);

create table public.purchase_request_items (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.purchase_requests(id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 1 and 180),
  activity text not null check (char_length(btrim(activity)) between 1 and 160),
  quantity numeric(12,3) not null check (quantity > 0 and quantity < 'Infinity'::numeric),
  unit text not null check (unit in ('unidade','kit','pacote','caixa','fardo','par','dúzia','rolo','folha','frasco','garrafa','saco','bandeja','kg','g','L','mL','m','m²','hora','diária')),
  needed_on date not null,
  estimated_amount numeric(14,2) check (estimated_amount >= 0 and estimated_amount < 'Infinity'::numeric),
  publication_id bigint not null,
  obz_line_id uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (publication_id, obz_line_id) references public.purchase_budget_lines on delete restrict
);

create index purchase_request_items_request_idx on public.purchase_request_items(request_id,id);

alter table public.purchase_budget_publications enable row level security;
alter table public.purchase_budget_lines enable row level security;
alter table public.purchase_request_items enable row level security;

revoke all on public.purchase_budget_publications, public.purchase_budget_lines, public.purchase_request_items
  from public, anon, authenticated;
grant select (id,center_id,center_code,center_name,fiscal_year,published_at)
  on public.purchase_budget_publications to authenticated;
grant insert (center_id) on public.purchase_budget_publications to authenticated;
grant select on public.purchase_budget_lines to authenticated;
grant select (id,request_id,description,activity,quantity,unit,needed_on,estimated_amount,publication_id,obz_line_id)
  on public.purchase_request_items to authenticated;
grant insert (request_id,description,activity,quantity,unit,needed_on,estimated_amount,publication_id,obz_line_id)
  on public.purchase_request_items to authenticated;

create policy purchase_publications_read on public.purchase_budget_publications
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active)
);
create policy purchase_publications_create on public.purchase_budget_publications
for insert to authenticated with check (published_by=(select auth.uid()) and public.obz_is_admin());

create policy purchase_budget_lines_read on public.purchase_budget_lines
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active)
);
create policy purchase_items_read on public.purchase_request_items
for select to authenticated using (
  exists (select 1 from public.purchase_requests p where p.id=request_id)
);
create policy purchase_items_create on public.purchase_request_items
for insert to authenticated with check (
  created_by=(select auth.uid())
  and exists (select 1 from public.purchase_requests p where p.id=request_id)
);

-- Clients can insert only the center ID. The trigger copies the approved data
-- and refuses publication for every profile except an OBZ administrator.
create view public.purchase_current_budget_publications
with (security_invoker=true) as
select distinct on (center_id) id,center_id,center_code,center_name,fiscal_year,published_at
from public.purchase_budget_publications
order by center_id,published_at desc,id desc;
revoke all on public.purchase_current_budget_publications from public, anon, authenticated;
grant select on public.purchase_current_budget_publications to authenticated;

create function cdl_purchase_private.prepare_budget_publication() returns trigger
language plpgsql security definer set search_path=''
as $$
declare c public.obz_centers%rowtype;
begin
  if auth.uid() is null or not coalesce(public.obz_is_admin(),false) then
    raise exception 'Publicação restrita ao administrador do OBZ.' using errcode='42501';
  end if;
  select * into c from public.obz_centers where id=new.center_id for update;
  if not found or c.status is distinct from 'approved' then
    raise exception 'O pacote do centro precisa estar aprovado.';
  end if;
  new.center_code := c.code;
  new.center_name := c.name;
  new.fiscal_year := c.fiscal_year;
  new.published_at := clock_timestamp();
  new.published_by := auth.uid();
  return new;
end;
$$;

create function cdl_purchase_private.snapshot_budget_lines() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not coalesce(public.obz_is_admin(),false) then
    raise exception 'Publicação restrita ao administrador do OBZ.' using errcode='42501';
  end if;
  insert into public.purchase_budget_lines(publication_id,obz_line_id,description,account_code,approved_amount)
  select new.id,l.id,l.description,l.account_code,total.amount
  from public.obz_lines l
  cross join lateral (select round(coalesce(sum(m.value),0)::numeric,2) as amount from unnest(l.months) as m(value)) total
  where l.center_id=new.center_id and l.category='expense'
    and total.amount>0 and total.amount<'Infinity'::numeric;
  if not found then raise exception 'O centro não tem rubricas de despesa com valor positivo.'; end if;
  return null;
end;
$$;

create function cdl_purchase_private.validate_item_budget() returns trigger
language plpgsql security definer set search_path=''
as $$
declare published_center uuid; publication_year integer; current_publication bigint;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id=auth.uid() and p.active) then
    raise exception 'Perfil interno ativo obrigatório.' using errcode='42501';
  end if;
  select p.center_id,p.fiscal_year into published_center,publication_year
  from public.purchase_budget_publications p where p.id=new.publication_id;
  if not found or publication_year<>extract(year from new.needed_on) then
    raise exception 'Selecione uma rubrica publicada do exercício da data de necessidade.';
  end if;
  perform 1 from public.obz_centers where id=published_center for update;
  select p.id into current_publication from public.purchase_budget_publications p
  where p.center_id=published_center order by p.published_at desc,p.id desc limit 1;
  if new.publication_id is distinct from current_publication then
    raise exception 'Uma versão mais recente foi publicada. Atualize e selecione a rubrica novamente.';
  end if;
  return new;
end;
$$;

revoke all on all functions in schema cdl_purchase_private from public, anon, authenticated;
create trigger purchase_publication_prepare before insert on public.purchase_budget_publications
for each row execute function cdl_purchase_private.prepare_budget_publication();
create trigger purchase_publication_snapshot after insert on public.purchase_budget_publications
for each row execute function cdl_purchase_private.snapshot_budget_lines();
create trigger purchase_item_check_budget before insert on public.purchase_request_items
for each row execute function cdl_purchase_private.validate_item_budget();

commit;
