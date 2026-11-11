begin;

create table public.demand_purchase_decisions (
  id bigint generated always as identity primary key,
  demand_id uuid not null references public.demands(id) on delete restrict,
  decision text not null check (decision in ('pending', 'no', 'yes')),
  decided_by uuid not null default auth.uid(),
  decided_at timestamptz not null default now()
);

create index demand_purchase_decisions_latest
  on public.demand_purchase_decisions (demand_id, id desc);

alter table public.demand_purchase_decisions enable row level security;
revoke all on public.demand_purchase_decisions from public, anon, authenticated;
grant select (id, demand_id, decision, decided_at) on public.demand_purchase_decisions to authenticated;
grant insert (demand_id, decision) on public.demand_purchase_decisions to authenticated;

create policy demand_purchase_decisions_read on public.demand_purchase_decisions
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active)
  and exists (select 1 from public.demands d where d.id = demand_id)
);

create policy demand_purchase_decisions_record on public.demand_purchase_decisions
for insert to authenticated with check (
  decided_by = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active)
  and exists (select 1 from public.demands d where d.id = demand_id and d.active)
);

commit;
