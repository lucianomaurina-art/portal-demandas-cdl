-- 008 • Correção da gestão de usuários novos
-- Portal Comercial SPC Dados | CDL Novo Hamburgo
-- Executar no SQL Editor do Supabase após a 007.

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
begin
  if auth.uid() is null or not public.is_cdl_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  select u.email::text
    into v_email
  from auth.users u
  where u.id = p_user_id;

  if v_email is null then
    raise exception 'Usuário não encontrado no Authentication.';
  end if;

  if p_role not in ('colaborador','manager','admin') then
    raise exception 'Perfil inválido.';
  end if;

  -- Se o perfil já existe, apenas atualiza. Isso evita interferir em outros
  -- campos da tabela profiles que possam ser obrigatórios ou controlados por trigger.
  if exists (select 1 from public.profiles where id = p_user_id) then
    update public.profiles
       set name   = nullif(trim(coalesce(p_name,'')),''),
           sector = nullif(trim(coalesce(p_sector,'')),''),
           role   = p_role,
           active = coalesce(p_active,true)
     where id = p_user_id;
    return;
  end if;

  -- Usuários recém-criados no Auth podem ainda não ter linha em profiles.
  -- A função se adapta caso a tabela profiles possua uma coluna email obrigatória.
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
            p_role,
            coalesce(p_active,true);
  else
    execute 'insert into public.profiles (id,name,sector,role,active) values ($1,$2,$3,$4,$5)'
      using p_user_id,
            nullif(trim(coalesce(p_name,'')),''),
            nullif(trim(coalesce(p_sector,'')),''),
            p_role,
            coalesce(p_active,true);
  end if;
end;
$$;

revoke all on function public.admin_update_portal_user(uuid,text,text,text,boolean) from public;
grant execute on function public.admin_update_portal_user(uuid,text,text,text,boolean) to authenticated;

-- Diagnóstico opcional: mostra quais usuários do Authentication ainda não têm perfil.
select
  u.email,
  case when p.id is null then 'SEM PERFIL' else 'OK' end as situacao,
  p.sector,
  p.role,
  p.active
from auth.users u
left join public.profiles p on p.id = u.id
order by u.email;
