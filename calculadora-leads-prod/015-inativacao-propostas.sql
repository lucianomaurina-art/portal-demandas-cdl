-- 015 • Inativação lógica de propostas
-- Execute no SQL Editor do Supabase após a migração 014.

alter table public.lead_proposals
  add column if not exists active boolean not null default true;

alter table public.lead_proposals
  add column if not exists inactivated_at timestamptz;

alter table public.lead_proposals
  add column if not exists inactivated_by uuid references auth.users(id);

create or replace function public.admin_set_proposal_active(
  p_proposal_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_cdl_admin() then
    raise exception 'Ação exclusiva do administrador.';
  end if;

  update public.lead_proposals
     set active = p_active,
         inactivated_at = case when p_active then null else now() end,
         inactivated_by = case when p_active then null else auth.uid() end,
         updated_at = now()
   where id = p_proposal_id;

  if not found then
    raise exception 'Proposta não encontrada.';
  end if;

  return true;
end;
$$;

grant execute on function public.admin_set_proposal_active(uuid,boolean) to authenticated;