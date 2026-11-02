-- 022 — Novos desfechos comerciais, recontagem vinculada e cancelamento operacional
-- Execute no SQL Editor do Supabase após as migrações anteriores.

begin;

-- 1) Novas etapas do Kanban de propostas.
alter table public.lead_proposals
  add column if not exists closed_at timestamptz;

alter table public.lead_proposals
  drop constraint if exists lead_proposals_status_check;

alter table public.lead_proposals
  add constraint lead_proposals_status_check check (status in (
    'Rascunho','Gerada','Enviada','Aprovada','Perdida','Cancelada',
    'Pendente','Validação da proposta junto ao SPC Brasil','Proposta enviada',
    'Proposta fechada (teste)','Proposta fechada','Proposta rejeitada',
    'Contagem SPC Brasil','Validação da contagem','Ordem de produção SPC Brasil',
    'Produção/faturamento SPC Brasil','Validação dos dados SPC Brasil',
    'Aguardando envio da compra de leads do SPC Brasil',
    'Dados enviados ao cliente','Compra de leads enviada para o cliente',
    'Negócio perdido'
  ));

-- Fechamentos de teste também iniciam o marco operacional.
update public.lead_proposals
set closed_at = coalesce(closed_at, updated_at)
where status in ('Proposta fechada','Proposta fechada (teste)')
  and closed_at is null;

create or replace function public.stamp_lead_proposal_closed_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('Proposta fechada','Proposta fechada (teste)')
       and new.closed_at is null then
      new.closed_at := now();
    end if;
  elsif new.status in ('Proposta fechada','Proposta fechada (teste)')
        and old.status is distinct from new.status then
    new.closed_at := coalesce(new.closed_at, now());
  end if;
  return new;
end;
$$;

-- 2) Rastreabilidade entre a ordem anterior e a nova ordem de recontagem.
alter table public.spc_data_orders
  add column if not exists parent_order_id uuid references public.spc_data_orders(id) on delete set null,
  add column if not exists revision_number integer not null default 1,
  add column if not exists recount_reason text;

alter table public.spc_data_orders
  drop constraint if exists spc_data_orders_revision_number_check;

alter table public.spc_data_orders
  add constraint spc_data_orders_revision_number_check check (revision_number >= 1);

create index if not exists spc_data_orders_parent_order_idx
  on public.spc_data_orders(parent_order_id);

-- A ordem rejeitada permanece visível em Recontagem, enquanto uma nova ordem
-- passa a ser a ordem operacional corrente da mesma proposta.
drop index if exists public.spc_data_orders_active_proposal_uidx;

create unique index spc_data_orders_active_proposal_uidx
  on public.spc_data_orders(proposal_id)
  where active = true
    and stage not in ('Recontagem','Cancelada');

alter table public.spc_data_orders
  drop constraint if exists spc_data_orders_stage_check;

alter table public.spc_data_orders
  add constraint spc_data_orders_stage_check check (stage in (
    'Solicitar contagem',
    'Contagem enviada ao SPC',
    'Validar contagem',
    'Recontagem',
    'Aguardando planilha de dados',
    'Dados enviados ao cliente',
    'Cancelada'
  ));

-- 3) Atualiza a visão de SLA. Recontagem e cancelamento encerram o prazo da
-- ordem anterior; a nova ordem recebe um novo marco operacional.
drop view if exists public.spc_data_order_sla;

create view public.spc_data_order_sla
with (security_invoker = true)
as
with base as (
  select
    o.*,
    p.code as proposal_code,
    p.closed_at as proposal_closed_source_at,
    p.updated_at as proposal_updated_at,
    coalesce(o.proposal_closed_at, p.closed_at, p.updated_at, o.created_at) as sla_started_at,
    coalesce(o.proposal_closed_at, p.closed_at, p.updated_at, o.created_at) + interval '15 days' as overall_due_at,
    case o.stage
      when 'Solicitar contagem' then coalesce(o.proposal_closed_at, p.closed_at, p.updated_at, o.created_at) + interval '1 day'
      when 'Contagem enviada ao SPC' then coalesce(o.count_sent_at, o.count_requested_at, o.updated_at) + interval '7 days'
      when 'Validar contagem' then coalesce(o.count_returned_at, o.updated_at) + interval '1 day'
      when 'Aguardando planilha de dados' then coalesce(o.production_requested_at, o.count_validated_at, o.updated_at) + interval '6 days'
      else null
    end as stage_due_at
  from public.spc_data_orders o
  join public.lead_proposals p on p.id = o.proposal_id
)
select
  b.*,
  case
    when b.stage = 'Dados enviados ao cliente' then 'concluido'
    when b.stage = 'Recontagem' then 'recontagem'
    when b.stage = 'Cancelada' then 'cancelado'
    when b.stage_due_at is not null and now() > b.stage_due_at then 'atrasado'
    when b.stage_due_at is not null and now() + interval '24 hours' >= b.stage_due_at then 'atencao'
    else 'em_dia'
  end as stage_sla_state,
  case
    when b.stage = 'Dados enviados ao cliente' and b.data_delivered_at <= b.overall_due_at then 'concluido_no_prazo'
    when b.stage = 'Dados enviados ao cliente' then 'concluido_atrasado'
    when b.stage = 'Recontagem' then 'recontagem'
    when b.stage = 'Cancelada' then 'cancelado'
    when now() > b.overall_due_at then 'atrasado'
    when now() + interval '24 hours' >= b.overall_due_at then 'atencao'
    else 'em_dia'
  end as overall_sla_state
from base b;

grant select on public.spc_data_order_sla to authenticated;

commit;

-- Conferência rápida.
select status,count(*) from public.lead_proposals
where status in ('Proposta fechada (teste)','Proposta rejeitada')
group by status order by status;

select id,proposal_id,parent_order_id,revision_number,stage,recount_reason
from public.spc_data_orders
order by created_at desc
limit 20;
