-- 009 • Normalização definitiva dos perfis de usuário
-- Portal Comercial SPC Dados | CDL Novo Hamburgo
-- Executar no SQL Editor do Supabase após a 008.

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
    coalesce(p.name, split_part(u.email, '@', 1))::text,
    p.sector::text,
    coalesce(p.role, 'collaborator')::text,
    coalesce(p.active, true),
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.email;
end;
$$;

revoke all on function public.admin_list_portal_users() from public;
grant execute on function public.admin_list_portal_users() to authenticated;

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
declare
  v_email text;
  v_has_email_column boolean;
  v_role text;
begin
  if auth.uid() is null or not public.is_cdl_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  select u.email::text into v_email
  from auth.users u
  where u.id = p_user_id;

  if v_email is null then
    raise exception 'Usuário não encontrado no Authentication.';
  end if;

  -- Compatibilidade defensiva com versões anteriores da interface.
  v_role := case
    when p_role = 'colaborador' then 'collaborator'
    else p_role
  end;

  if v_role not in ('collaborator','manager','admin') then
    raise exception 'Perfil inválido.';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id) then
    update public.profiles
       set name   = nullif(trim(coalesce(p_name,'')),''),
           sector = nullif(trim(coalesce(p_sector,'')),''),
           role   = v_role,
           active = coalesce(p_active,true)
     where id = p_user_id;
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
  ) into v_has_email_column;

  if v_has_email_column then
    execute 'insert into public.profiles (id,email,name,sector,role,active) values ($1,$2,$3,$4,$5,$6)'
      using p_user_id,
            v_email,
            nullif(trim(coalesce(p_name,'')),''),
            nullif(trim(coalesce(p_sector,'')),''),
            v_role,
            coalesce(p_active,true);
  else
    execute 'insert into public.profiles (id,name,sector,role,active) values ($1,$2,$3,$4,$5)'
      using p_user_id,
            nullif(trim(coalesce(p_name,'')),''),
            nullif(trim(coalesce(p_sector,'')),''),
            v_role,
            coalesce(p_active,true);
  end if;
end;
$$;

revoke all on function public.admin_update_portal_user(uuid,text,text,text,boolean) from public;
grant execute on function public.admin_update_portal_user(uuid,text,text,text,boolean) to authenticated;
