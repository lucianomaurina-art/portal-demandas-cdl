-- 016 — Separa o funil comercial da proposta do fluxo operacional SPC
-- Propostas terminam em Proposta fechada ou Negócio perdido.
-- Ordens SPC passam a controlar contagem, validação e entrega.

begin;

-- 1) Atualiza as etapas das ordens já existentes para o novo fluxo.
alter table public.spc_data_orders drop constraint if exists spc_data_orders_stage_check;

update public.spc_data_orders set stage='Solicitar contagem' where stage='Contagem SPC Brasil';
update public.spc_data_orders set stage='Validar contagem' where stage='Validação da contagem';
update public.spc_data_orders set stage='Aguardando planilha de dados' where stage in ('Ordem de produção SPC Brasil','Produção/faturamento SPC Brasil');

alter table public.spc_data_orders
  add constraint spc_data_orders_stage_check check (stage in (
    'Solicitar contagem',
    'Validar contagem',
    'Aguardando planilha de dados',
    'Dados enviados ao cliente',
    'Cancelada'
  ));

-- 2) O andamento operacional deixa de alterar o estágio comercial da proposta.
-- Registros legados que avançaram para etapas operacionais voltam a ficar como
-- Proposta fechada; o estágio operacional passa a viver exclusivamente em spc_data_orders.
update public.lead_proposals
set status='Proposta fechada', updated_at=now()
where status in (
  'Validação dos dados SPC Brasil',
  'Contagem SPC Brasil',
  'Validação da contagem',
  'Ordem de produção SPC Brasil',
  'Produção/faturamento SPC Brasil',
  'Aguardando envio da compra de leads do SPC Brasil',
  'Dados enviados ao cliente',
  'Compra de leads enviada para o cliente'
);

commit;
