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

-- Banco de Ideias
create sequence if not exists idea_code_seq start 1;

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default ('IDEIA-' || lpad(nextval('idea_code_seq')::text,4,'0')),
  created_at timestamptz not null default now(),
  author text not null check (char_length(author) between 2 and 100),
  email text,
  origin text not null,
  theme text not null,
  title text not null check (char_length(title) between 3 and 140),
  problem text not null,
  description text not null,
  beneficiaries text not null,
  expected_benefit text not null,
  similar_initiative text,
  partners text,
  reference_notes text,
  stage text not null default 'Nova' check (stage in ('Nova','Em triagem','Em análise','Priorizada','Em desenvolvimento','Transformada em projeto','Relacionada ou duplicada','Arquivada')),
  reviewer text,
  score_alignment smallint not null default 0 check (score_alignment between 0 and 5),
  score_impact smallint not null default 0 check (score_impact between 0 and 5),
  score_reach smallint not null default 0 check (score_reach between 0 and 5),
  score_synergy smallint not null default 0 check (score_synergy between 0 and 5),
  score_feasibility smallint not null default 0 check (score_feasibility between 0 and 5),
  score_urgency smallint not null default 0 check (score_urgency between 0 and 5),
  priority_score numeric(3,1) not null default 0,
  related_idea_id uuid references public.ideas(id) on delete set null,
  project_name text,
  management_notes text,
  updated_at timestamptz not null default now()
);

alter table public.ideas enable row level security;

drop policy if exists "authenticated_read_ideas" on public.ideas;
create policy "authenticated_read_ideas" on public.ideas
for select to authenticated using (true);

drop policy if exists "authenticated_update_ideas" on public.ideas;
create policy "authenticated_update_ideas" on public.ideas
for update to authenticated using (true) with check (true);

grant select,update on public.ideas to authenticated;

create or replace function public.submit_idea(
  p_author text,
  p_email text,
  p_origin text,
  p_theme text,
  p_title text,
  p_problem text,
  p_description text,
  p_beneficiaries text,
  p_expected_benefit text,
  p_similar_initiative text,
  p_partners text,
  p_references text
) returns text
language plpgsql
security definer
set search_path=public
as $$
declare new_code text;
begin
  if nullif(trim(p_author),'') is null
     or nullif(trim(p_origin),'') is null
     or nullif(trim(p_theme),'') is null
     or nullif(trim(p_title),'') is null
     or nullif(trim(p_problem),'') is null
     or nullif(trim(p_description),'') is null
     or nullif(trim(p_beneficiaries),'') is null
     or nullif(trim(p_expected_benefit),'') is null then
    raise exception 'Preencha todos os campos obrigatórios.';
  end if;

  insert into public.ideas(
    author,email,origin,theme,title,problem,description,beneficiaries,
    expected_benefit,similar_initiative,partners,reference_notes
  ) values (
    trim(p_author),nullif(trim(p_email),''),trim(p_origin),trim(p_theme),
    trim(p_title),trim(p_problem),trim(p_description),trim(p_beneficiaries),
    trim(p_expected_benefit),nullif(trim(p_similar_initiative),''),
    nullif(trim(p_partners),''),nullif(trim(p_references),'')
  ) returning code into new_code;

  return new_code;
end;
$$;

revoke all on function public.submit_idea(text,text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_idea(text,text,text,text,text,text,text,text,text,text,text,text) to anon,authenticated;


-- Inativação segura de demandas e ideias (somente administrador).
alter table public.demands
  add column if not exists active boolean not null default true,
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references auth.users(id) on delete set null;

alter table public.ideas
  add column if not exists active boolean not null default true,
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references auth.users(id) on delete set null;

drop policy if exists "authenticated_read_demands" on public.demands;
create policy "authenticated_read_demands" on public.demands
for select to authenticated
using (active=true or public.is_cdl_admin());

drop policy if exists "authenticated_read_ideas" on public.ideas;
create policy "authenticated_read_ideas" on public.ideas
for select to authenticated
using (active=true or public.is_cdl_admin());

-- Impede alteração direta dos campos de inativação.
revoke update on public.demands from authenticated;
grant update(requester,email,nucleus,sector,description,expected_result,deadline,priority,status,assignee,notes,updated_at)
on public.demands to authenticated;

revoke update on public.ideas from authenticated;
grant update(author,email,origin,theme,title,problem,description,beneficiaries,expected_benefit,
  similar_initiative,partners,reference_notes,stage,reviewer,score_alignment,score_impact,
  score_reach,score_synergy,score_feasibility,score_urgency,priority_score,related_idea_id,
  project_name,management_notes,updated_at)
on public.ideas to authenticated;

create or replace function public.set_demand_active(p_id uuid,p_active boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_cdl_admin() then
    raise exception 'Apenas administradores podem inativar ou reativar demandas.';
  end if;
  update public.demands
  set active=p_active,
      inactivated_at=case when p_active then null else now() end,
      inactivated_by=case when p_active then null else auth.uid() end,
      updated_at=now()
  where id=p_id;
  if not found then raise exception 'Demanda não encontrada.'; end if;
end;
$$;

create or replace function public.set_idea_active(p_id uuid,p_active boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_cdl_admin() then
    raise exception 'Apenas administradores podem inativar ou reativar ideias.';
  end if;
  update public.ideas
  set active=p_active,
      inactivated_at=case when p_active then null else now() end,
      inactivated_by=case when p_active then null else auth.uid() end,
      updated_at=now()
  where id=p_id;
  if not found then raise exception 'Ideia não encontrada.'; end if;
end;
$$;

revoke all on function public.set_demand_active(uuid,boolean) from public;
revoke all on function public.set_idea_active(uuid,boolean) from public;
grant execute on function public.set_demand_active(uuid,boolean) to authenticated;
grant execute on function public.set_idea_active(uuid,boolean) to authenticated;
