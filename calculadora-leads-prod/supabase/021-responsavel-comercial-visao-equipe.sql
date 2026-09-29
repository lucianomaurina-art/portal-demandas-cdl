-- Responsável comercial e visão compartilhada de solicitações/propostas.
-- Todos os usuários ativos visualizam o funil; gestores e administradores atribuem responsáveis.

alter table public.lead_proposals
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

update public.lead_proposals
set assigned_to = created_by
where assigned_to is null;

create index if not exists idx_lead_quote_requests_handled_by
  on public.lead_quote_requests(handled_by);

create index if not exists idx_lead_proposals_assigned_to
  on public.lead_proposals(assigned_to);

create or replace function public.list_active_commercial_users()
returns table (id uuid, email text, name text, role text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles me where me.id = auth.uid() and me.active = true
  ) then
    raise exception 'Acesso não autorizado.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(nullif(trim(p.name),''), split_part(u.email,'@',1))::text,
    coalesce(p.role,'collaborator')::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.active = true
  order by coalesce(nullif(trim(p.name),''), u.email);
end;
$$;

revoke all on function public.list_active_commercial_users() from public;
grant execute on function public.list_active_commercial_users() to authenticated;

create or replace function public.assign_commercial_owner(
  p_record_type text,
  p_record_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.active = true
      and me.role in ('manager','admin')
  ) then
    raise exception 'A atribuição de responsável é exclusiva do gestor ou administrador.';
  end if;

  if p_user_id is not null and not exists (
    select 1 from public.profiles p where p.id = p_user_id and p.active = true
  ) then
    raise exception 'O responsável selecionado não está ativo.';
  end if;

  if p_record_type = 'request' then
    update public.lead_quote_requests
       set handled_by = p_user_id, updated_at = now()
     where id = p_record_id;
  elsif p_record_type = 'proposal' then
    update public.lead_proposals
       set assigned_to = p_user_id, updated_at = now()
     where id = p_record_id;
  else
    raise exception 'Tipo de registro inválido.';
  end if;
end;
$$;

revoke all on function public.assign_commercial_owner(text,uuid,uuid) from public;
grant execute on function public.assign_commercial_owner(text,uuid,uuid) to authenticated;

drop policy if exists lead_proposals_own_read on public.lead_proposals;
drop policy if exists lead_proposals_team_read on public.lead_proposals;
create policy lead_proposals_team_read
on public.lead_proposals for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  )
);

drop policy if exists lead_proposals_own_update on public.lead_proposals;
drop policy if exists lead_proposals_team_update on public.lead_proposals;
create policy lead_proposals_team_update
on public.lead_proposals for update to authenticated
using (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('manager','admin')
  )
)
with check (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('manager','admin')
  )
);

grant select, update on public.lead_proposals to authenticated;
