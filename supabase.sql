create extension if not exists pgcrypto;
create sequence if not exists demand_protocol_seq start 1;
create table if not exists public.demands (
  id uuid primary key default gen_random_uuid(),
  protocol text unique not null default ('D-' || lpad(nextval('demand_protocol_seq')::text, 4, '0')),
  created_at timestamptz not null default now(),
  requester text not null check (char_length(requester) between 2 and 100),
  email text,
  nucleus text not null,
  sector text not null,
  description text not null check (char_length(description) between 3 and 1500),
  expected_result text not null,
  deadline date not null,
  priority text not null default 'Média' check (priority in ('Urgente','Alta','Média','Baixa')),
  status text not null default 'Não iniciado' check (status in ('Não iniciado','Em andamento','Aguardando retorno','Concluído','Cancelado')),
  assignee text,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.demands enable row level security;
drop policy if exists "public_insert_demands" on public.demands;
create policy "public_insert_demands" on public.demands for insert to anon with check (true);
drop policy if exists "authenticated_read_demands" on public.demands;
create policy "authenticated_read_demands" on public.demands for select to authenticated using (true);
drop policy if exists "authenticated_update_demands" on public.demands;
create policy "authenticated_update_demands" on public.demands for update to authenticated using (true) with check (true);
grant usage on schema public to anon, authenticated;
grant usage, select on sequence demand_protocol_seq to anon, authenticated;
grant insert on public.demands to anon;
grant select, update on public.demands to authenticated;
