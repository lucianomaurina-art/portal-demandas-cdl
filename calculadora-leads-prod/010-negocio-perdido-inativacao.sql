-- 010 • Negócio perdido + inativação administrativa de solicitações
-- Execute no SQL Editor do Supabase após as migrações anteriores.

-- 1. Novo desfecho do funil comercial.
alter table public.lead_proposals drop constraint if exists lead_proposals_status_check;
alter table public.lead_proposals add constraint lead_proposals_status_check check (status in (
  'Rascunho','Pendente','Proposta enviada','Proposta fechada',
  'Aguardando envio da compra de leads do SPC Brasil',
  'Compra de leads enviada para o cliente','Negócio perdido',
  'Perdida','Cancelada','Gerada','Enviada','Aprovada'
));

alter table public.lead_quote_requests drop constraint if exists lead_quote_requests_status_check;
alter table public.lead_quote_requests add constraint lead_quote_requests_status_check check (status in (
  'Nova','Pendente','Em análise','Proposta gerada','Respondida','Encerrada',
  'Proposta enviada','Proposta fechada',
  'Aguardando envio da compra de leads do SPC Brasil',
  'Compra de leads enviada para o cliente','Negócio perdido'
));

-- 2. Inativação lógica: preserva histórico, mas retira a solicitação das telas operacionais.
alter table public.lead_quote_requests
  add column if not exists active boolean not null default true;

alter table public.lead_quote_requests
  add column if not exists inactivated_at timestamptz;

alter table public.lead_quote_requests
  add column if not exists inactivated_by uuid references auth.users(id);

-- 3. RPC administrativa para inativar/reativar sem permitir que usuários comuns façam isso.
create or replace function public.admin_set_quote_request_active(
  p_request_id uuid,
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

  update public.lead_quote_requests
     set active = p_active,
         inactivated_at = case when p_active then null else now() end,
         inactivated_by = case when p_active then null else auth.uid() end,
         updated_at = now()
   where id = p_request_id;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  return true;
end;
$$;

grant execute on function public.admin_set_quote_request_active(uuid,boolean) to authenticated;
