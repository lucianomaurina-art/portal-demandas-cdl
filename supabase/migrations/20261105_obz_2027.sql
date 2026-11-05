-- OBZ 2027: isolated budget domain. Run in Supabase SQL editor after review.
-- No changes to existing demand/idea tables or their policies.
create table if not exists public.obz_centers (
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 name text not null,
 fiscal_year int not null default 2027 check (fiscal_year between 2027 and 2100),
 manager_id uuid references auth.users(id),
 status text not null default 'draft' check(status in ('draft','submitted','in_review','changes_requested','approved')),
 source_name text,
 source_updated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.obz_lines (
 id uuid primary key default gen_random_uuid(),
 center_id uuid not null references public.obz_centers(id) on delete cascade,
 source_key text not null,
 category text not null check(category in ('revenue','expense')),
 description text not null,
 account_code text,
 months numeric(16,2)[] not null check(array_length(months,1)=12),
 justification text not null default '',
 alternative text not null default '',
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(center_id,source_key)
);
create table if not exists public.obz_audit (
 id bigint generated always as identity primary key,
 center_id uuid not null references public.obz_centers(id),
 line_id uuid references public.obz_lines(id),
 actor_id uuid not null references auth.users(id),
 action text not null,
 old_value jsonb,
 new_value jsonb,
 created_at timestamptz not null default now()
);
create or replace function public.obz_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active=true and role='admin');
$$;
create or replace function public.obz_can_manage(p_center uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.obz_is_admin() or exists (
 select 1 from public.obz_centers c join public.profiles p on p.id=auth.uid()
 where c.id=p_center and c.manager_id=auth.uid() and p.active=true);
$$;
alter table public.obz_centers enable row level security;
alter table public.obz_lines enable row level security;
alter table public.obz_audit enable row level security;
drop policy if exists obz_centers_read on public.obz_centers;
create policy obz_centers_read on public.obz_centers for select to authenticated
 using (public.obz_is_admin() or (manager_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active)));
drop policy if exists obz_centers_admin_insert on public.obz_centers;
create policy obz_centers_admin_insert on public.obz_centers for insert to authenticated with check(public.obz_is_admin());
drop policy if exists obz_centers_admin_update on public.obz_centers;
create policy obz_centers_admin_update on public.obz_centers for update to authenticated using(public.obz_is_admin()) with check(public.obz_is_admin());
drop policy if exists obz_lines_read on public.obz_lines;
create policy obz_lines_read on public.obz_lines for select to authenticated using(public.obz_can_manage(center_id));
drop policy if exists obz_lines_admin_insert on public.obz_lines;
create policy obz_lines_admin_insert on public.obz_lines for insert to authenticated with check(public.obz_is_admin());
drop policy if exists obz_lines_admin_update on public.obz_lines;
create policy obz_lines_admin_update on public.obz_lines for update to authenticated
 using(public.obz_is_admin() or (public.obz_can_manage(center_id) and exists(select 1 from public.obz_centers c where c.id=center_id and c.status in ('draft','changes_requested'))))
 with check(public.obz_can_manage(center_id));
drop policy if exists obz_audit_read on public.obz_audit;
create policy obz_audit_read on public.obz_audit for select to authenticated using(public.obz_can_manage(center_id));
-- All edits are audited at the database level; no direct audit inserts by clients.
create or replace function public.obz_audit_line()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.obz_audit(center_id,line_id,actor_id,action,old_value,new_value)
 values(new.center_id,new.id,auth.uid(),tg_op,to_jsonb(old),to_jsonb(new));
 return new;
end; $$;
drop trigger if exists obz_audit_line_changes on public.obz_lines;
create trigger obz_audit_line_changes after update on public.obz_lines for each row
 when(old.* is distinct from new.*) execute function public.obz_audit_line();
create or replace function public.obz_change_status(p_center uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare c public.obz_centers%rowtype; v_admin boolean;
begin
 select * into c from public.obz_centers where id=p_center for update;
 if not found then raise exception 'Pacote inexistente'; end if;
 v_admin:=public.obz_is_admin();
 if not public.obz_can_manage(p_center) then raise exception 'Acesso negado'; end if;
 if not ((not v_admin and c.status in ('draft','changes_requested') and p_status='submitted')
 or (v_admin and ((c.status='submitted' and p_status in ('in_review','changes_requested','approved'))
 or (c.status='in_review' and p_status in ('changes_requested','approved'))
 or (c.status='approved' and p_status='changes_requested')
 or (c.status='changes_requested' and p_status='draft')))) then
 raise exception 'Transição de status não permitida';
 end if;
 update public.obz_centers set status=p_status,updated_at=now() where id=p_center;
 insert into public.obz_audit(center_id,actor_id,action,old_value,new_value)
 values(p_center,auth.uid(),'status',jsonb_build_object('status',c.status),jsonb_build_object('status',p_status));
end; $$;
revoke all on function public.obz_change_status(uuid,text) from public,anon;
grant execute on function public.obz_change_status(uuid,text) to authenticated;
grant select on public.obz_centers,public.obz_lines,public.obz_audit to authenticated;
grant insert,update on public.obz_centers,public.obz_lines to authenticated;
revoke all on public.obz_audit from anon,authenticated;
grant select on public.obz_audit to authenticated;
create index if not exists obz_lines_center_idx on public.obz_lines(center_id);
create index if not exists obz_audit_center_idx on public.obz_audit(center_id,created_at desc);
-- Seed center metadata only: no monetary data is written without verified import.
insert into public.obz_centers(code,name,fiscal_year,source_name)
values ('SPC_BRASIL','SPC BRASIL',2027,'Planilha Mestra OBZ 2027'),
('CERTIFICACAO_DIGITAL','CERTIFICACAO DIGITAL',2027,'Planilha Mestra OBZ 2027'),
('LOCACAO_ESPACOS','LOCACAO DE SALAS E ESPACOS',2027,'Planilha Mestra OBZ 2027')
on conflict(code) do nothing;
