-- 017 — SLA operacional das Ordens SPC + Kanban
-- Fluxo máximo: 15 dias corridos da proposta fechada até a entrega ao cliente.
-- 1 dia para enviar contagem + 7 dias SPC para retornar + 1 dia CDL para validar + 6 dias SPC para entregar dados.

begin;

-- Marco comercial imutável: o SLA total começa quando a proposta entra em "Proposta fechada".
alter table public.lead_proposals
  add column if not exists closed_at timestamptz;

update public.lead_proposals
set closed_at = coalesce(closed_at, updated_at)
where status = 'Proposta fechada'
  and closed_at is null;

create or replace function public.stamp_lead_proposal_closed_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'Proposta fechada' and new.closed_at is null then
      new.closed_at := now();
    end if;
  elsif new.status = 'Proposta fechada' and old.status is distinct from new.status then
    new.closed_at := coalesce(new.closed_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_lead_proposal_closed_at on public.lead_proposals;
create trigger trg_stamp_lead_proposal_closed_at
before insert or update on public.lead_proposals
for each row execute function public.stamp_lead_proposal_closed_at();

alter table public.spc_data_orders
  add column if not exists proposal_closed_at timestamptz,
  add column if not exists count_sent_at timestamptz,
  add column if not exists data_delivered_at timestamptz;

-- Nova etapa explícita: depois que a ordem de contagem é enviada ao SPC,
-- o cartão fica aguardando o retorno da contagem por até 7 dias.
alter table public.spc_data_orders
  drop constraint if exists spc_data_orders_stage_check;

alter table public.spc_data_orders
  add constraint spc_data_orders_stage_check check (stage in (
    'Solicitar contagem',
    'Contagem enviada ao SPC',
    'Validar contagem',
    'Aguardando planilha de dados',
    'Dados enviados ao cliente',
    'Cancelada'
  ));

-- Preserva o marco de fechamento da proposta nas ordens já existentes.
update public.spc_data_orders o
set proposal_closed_at = coalesce(o.proposal_closed_at, p.closed_at, p.updated_at, o.created_at)
from public.lead_proposals p
where p.id = o.proposal_id
  and o.proposal_closed_at is null;

-- Compatibilidade de registros já avançados no fluxo antigo.
update public.spc_data_orders
set count_sent_at = coalesce(count_sent_at, count_requested_at, created_at)
where count_sent_at is null
  and stage in ('Validar contagem','Aguardando planilha de dados','Dados enviados ao cliente');

update public.spc_data_orders
set data_delivered_at = coalesce(data_delivered_at, updated_at)
where data_delivered_at is null
  and stage = 'Dados enviados ao cliente';

create or replace function public.stamp_spc_data_order_sla()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_closed timestamptz;
  v_stage_changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_stage_changed := old.stage is distinct from new.stage;
  end if;

  if new.proposal_closed_at is null then
    select coalesce(p.closed_at, p.updated_at) into v_closed
    from public.lead_proposals p
    where p.id = new.proposal_id;
    new.proposal_closed_at := coalesce(v_closed, new.created_at, now());
  end if;

  -- Momento efetivo do envio da contagem ao SPC.
  if new.stage = 'Contagem enviada ao SPC'
     and (tg_op = 'INSERT' or v_stage_changed or new.count_sent_at is null) then
    new.count_sent_at := coalesce(new.count_sent_at, now());
    new.count_requested_at := coalesce(new.count_requested_at, new.count_sent_at);
  end if;

  -- Quando a contagem retorna, inicia o SLA interno de 1 dia para validação.
  if new.stage = 'Validar contagem'
     and (tg_op = 'INSERT' or v_stage_changed or new.count_returned_at is null) then
    new.count_returned_at := coalesce(new.count_returned_at, now());
  end if;

  -- Enquanto o cartão permanecer em "Validar contagem", salvar o formulário
  -- não deve antecipar o marco de validação. O marco nasce ao avançar a etapa.
  if tg_op = 'UPDATE'
     and new.stage = 'Validar contagem'
     and old.stage = 'Validar contagem' then
    new.count_validated_at := old.count_validated_at;
    new.production_requested_at := old.production_requested_at;
  end if;

  -- Após validar, inicia o prazo do SPC para produção/entrega da planilha.
  if new.stage = 'Aguardando planilha de dados'
     and (tg_op = 'INSERT' or v_stage_changed) then
    if tg_op = 'UPDATE' then
      new.count_validated_at := coalesce(old.count_validated_at, new.count_validated_at, now());
      new.production_requested_at := coalesce(old.production_requested_at, new.production_requested_at, new.count_validated_at, now());
    else
      new.count_validated_at := coalesce(new.count_validated_at, now());
      new.production_requested_at := coalesce(new.production_requested_at, new.count_validated_at, now());
    end if;
    new.purpose := 'producao';
  end if;

  if new.stage = 'Dados enviados ao cliente'
     and (tg_op = 'INSERT' or v_stage_changed or new.data_delivered_at is null) then
    new.data_delivered_at := coalesce(new.data_delivered_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stamp_spc_data_order_sla on public.spc_data_orders;
create trigger trg_stamp_spc_data_order_sla
before insert or update on public.spc_data_orders
for each row execute function public.stamp_spc_data_order_sla();

-- View de leitura para Kanban, indicadores e alertas Resend.
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
    when b.stage = 'Cancelada' then 'cancelado'
    when b.stage_due_at is not null and now() > b.stage_due_at then 'atrasado'
    when b.stage_due_at is not null and now() + interval '24 hours' >= b.stage_due_at then 'atencao'
    else 'em_dia'
  end as stage_sla_state,
  case
    when b.stage = 'Dados enviados ao cliente' and b.data_delivered_at <= b.overall_due_at then 'concluido_no_prazo'
    when b.stage = 'Dados enviados ao cliente' then 'concluido_atrasado'
    when now() > b.overall_due_at then 'atrasado'
    when now() + interval '24 hours' >= b.overall_due_at then 'atencao'
    else 'em_dia'
  end as overall_sla_state
from base b;

grant select on public.spc_data_order_sla to authenticated;

-- Log para impedir duplicidade quando os alertas por Resend forem habilitados.
create table if not exists public.spc_data_order_alert_log (
  id bigint generated by default as identity primary key,
  order_id uuid not null references public.spc_data_orders(id) on delete cascade,
  alert_type text not null,
  alert_date date not null default current_date,
  recipient text not null,
  sent_at timestamptz not null default now(),
  unique(order_id, alert_type, alert_date, recipient)
);

alter table public.spc_data_order_alert_log enable row level security;
revoke all on public.spc_data_order_alert_log from anon, authenticated;

commit;
