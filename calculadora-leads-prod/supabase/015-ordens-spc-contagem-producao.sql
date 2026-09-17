-- 015 — Ordens SPC Dados: contagem, validação e produção
-- Executar no Supabase SQL Editor após as migrações anteriores.

create table if not exists public.spc_data_orders (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.lead_proposals(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  stage text not null default 'Contagem SPC Brasil',
  purpose text not null default 'contagem',
  product text,
  person text,
  entity jsonb not null default jsonb_build_object(
    'company','Câmara de Dirigentes Lojistas de Novo Hamburgo',
    'code','22097',
    'contact','Priscila Cristiane de Oliveira Istan',
    'email','priscila@cdl-nh.com.br'
  ),
  client jsonb not null default '{}'::jsonb,
  targeting jsonb not null default '{}'::jsonb,
  requested_fields jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  external_notes text,
  internal_notes text,
  count_reference text,
  count_requested_at timestamptz,
  count_returned_at timestamptz,
  count_result integer,
  count_notes text,
  count_validated_at timestamptz,
  count_validated_by uuid,
  production_requested_at timestamptz,
  production_notes text,
  constraint spc_data_orders_stage_check check (stage in (
    'Contagem SPC Brasil',
    'Validação da contagem',
    'Ordem de produção SPC Brasil',
    'Produção/faturamento SPC Brasil',
    'Dados enviados ao cliente',
    'Cancelada'
  )),
  constraint spc_data_orders_purpose_check check (purpose in ('contagem','producao')),
  constraint spc_data_orders_count_result_check check (count_result is null or count_result >= 0)
);

create unique index if not exists spc_data_orders_active_proposal_uidx
  on public.spc_data_orders(proposal_id)
  where active = true;
create index if not exists spc_data_orders_stage_idx on public.spc_data_orders(stage);
create index if not exists spc_data_orders_created_at_idx on public.spc_data_orders(created_at desc);

alter table public.spc_data_orders enable row level security;

drop policy if exists spc_data_orders_select_authenticated on public.spc_data_orders;
create policy spc_data_orders_select_authenticated on public.spc_data_orders
  for select to authenticated using (true);

drop policy if exists spc_data_orders_insert_authenticated on public.spc_data_orders;
create policy spc_data_orders_insert_authenticated on public.spc_data_orders
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists spc_data_orders_update_authenticated on public.spc_data_orders;
create policy spc_data_orders_update_authenticated on public.spc_data_orders
  for update to authenticated using (true) with check (true);

grant select, insert, update on public.spc_data_orders to authenticated;
revoke all on public.spc_data_orders from anon;

create or replace function public.touch_spc_data_order_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_spc_data_order on public.spc_data_orders;
create trigger trg_touch_spc_data_order
before update on public.spc_data_orders
for each row execute function public.touch_spc_data_order_updated_at();

-- Ajusta o funil de propostas para refletir o processo real do SPC Dados.
do $$
begin
  alter table public.lead_proposals drop constraint if exists lead_proposals_status_check;
exception when undefined_table then null;
end $$;

alter table public.lead_proposals
  add constraint lead_proposals_status_check check (status in (
    'Rascunho','Gerada','Enviada','Aprovada','Perdida','Cancelada',
    'Pendente','Validação da proposta junto ao SPC Brasil','Proposta enviada','Proposta fechada',
    'Contagem SPC Brasil','Validação da contagem','Ordem de produção SPC Brasil',
    'Produção/faturamento SPC Brasil','Aguardando envio da compra de leads do SPC Brasil',
    'Dados enviados ao cliente','Compra de leads enviada para o cliente','Negócio perdido'
  ));

-- Compatibilidade: propostas que estavam na antiga etapa de validação passam para Contagem.
update public.lead_proposals
set status='Contagem SPC Brasil', updated_at=now()
where status='Validação dos dados SPC Brasil';
