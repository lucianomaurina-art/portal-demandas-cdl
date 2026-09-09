-- 007 • Gestão administrativa de usuários do Portal Comercial SPC Dados
-- Executar no SQL Editor do Supabase.

-- Lista usuários do Auth + perfil, somente para administradores.
create or replace function public.admin_list_portal_users()
returns table (
  id uuid,
  email text,
  name text,
  sector text,
  role text,
  active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.is_cdl_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.name, split_part(u.email, '@', 1))::text as name,
    p.sector::text,
    coalesce(p.role, 'colaborador')::text as role,
    coalesce(p.active, true) as active,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.email;
end;
$$;

revoke all on function public.admin_list_portal_users() from public;
grant execute on function public.admin_list_portal_users() to authenticated;

-- Atualiza ou cria o perfil de um usuário existente do Supabase Auth.
create or replace function public.admin_update_portal_user(
  p_user_id uuid,
  p_name text,
  p_sector text,
  p_role text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.is_cdl_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Usuário não encontrado no Authentication.';
  end if;

  if p_role not in ('colaborador','manager','admin') then
    raise exception 'Perfil inválido.';
  end if;

  insert into public.profiles (id, name, sector, role, active)
  values (
    p_user_id,
    nullif(trim(coalesce(p_name,'')),''),
    nullif(trim(coalesce(p_sector,'')),''),
    p_role,
    coalesce(p_active,true)
  )
  on conflict (id) do update set
    name = excluded.name,
    sector = excluded.sector,
    role = excluded.role,
    active = excluded.active;
end;
$$;

revoke all on function public.admin_update_portal_user(uuid,text,text,text,boolean) from public;
grant execute on function public.admin_update_portal_user(uuid,text,text,text,boolean) to authenticated;
