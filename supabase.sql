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
drop policy if exists "authenticated_read_demands" on public.demands;
create policy "authenticated_read_demands" on public.demands for select to authenticated using (true);
drop policy if exists "authenticated_update_demands" on public.demands;
create policy "authenticated_update_demands" on public.demands for update to authenticated using (true) with check (true);
grant usage on schema public to anon, authenticated;
grant select, update on public.demands to authenticated;

create or replace function public.submit_demand(
  p_requester text, p_email text, p_nucleus text, p_sector text,
  p_description text, p_expected_result text, p_deadline date,
  p_priority text, p_notes text
) returns text
language plpgsql security definer set search_path = public
as $$
declare new_protocol text;
begin
  if nullif(trim(p_requester),'') is null or nullif(trim(p_description),'') is null
     or nullif(trim(p_expected_result),'') is null or p_deadline is null then
    raise exception 'Preencha todos os campos obrigatórios.';
  end if;
  insert into public.demands(requester,email,nucleus,sector,description,expected_result,deadline,priority,notes)
  values(trim(p_requester),nullif(trim(p_email),''),p_nucleus,p_sector,trim(p_description),trim(p_expected_result),p_deadline,p_priority,nullif(trim(p_notes),''))
  returning protocol into new_protocol;
  return new_protocol;
end;
$$;
revoke all on function public.submit_demand(text,text,text,text,text,text,date,text,text) from public;
grant execute on function public.submit_demand(text,text,text,text,text,text,date,text,text) to anon, authenticated;

-- Perfis internos: setor padrão, papel e acesso individual.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  sector text,
  role text not null default 'collaborator' check (role in ('collaborator','manager','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

insert into public.profiles(id,email,name)
select id,email,coalesce(raw_user_meta_data->>'name',split_part(email,'@',1))
from auth.users
on conflict (id) do update set email=excluded.email;

-- O primeiro usuário do projeto torna-se administrador inicial.
update public.profiles
set role='admin'
where id=(select id from auth.users order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where role='admin');

create or replace function public.is_cdl_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active=true);
$$;

drop policy if exists "profile_read_self_or_admin" on public.profiles;
create policy "profile_read_self_or_admin" on public.profiles
for select to authenticated
using (id=auth.uid() or public.is_cdl_admin());

drop policy if exists "profile_admin_update" on public.profiles;
create policy "profile_admin_update" on public.profiles
for update to authenticated
using (public.is_cdl_admin())
with check (public.is_cdl_admin());

grant select on public.profiles to authenticated;
grant update(name,sector,role,active,updated_at) on public.profiles to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(id,email,name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();
