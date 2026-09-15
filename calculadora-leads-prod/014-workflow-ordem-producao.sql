-- 014 • Workflow pós-aprovação e ordem de produção SPC Dados
-- Execute no SQL Editor do Supabase após as migrações anteriores.

alter table public.lead_proposals drop constraint if exists lead_proposals_status_check;
alter table public.lead_proposals add constraint lead_proposals_status_check check (status in (
  'Rascunho','Pendente',
  'Validação da proposta junto ao SPC Brasil',
  'Proposta enviada','Proposta fechada',
  'Validação dos dados SPC Brasil',
  'Aguardando envio da compra de leads do SPC Brasil',
  'Dados enviados ao cliente',
  'Compra de leads enviada para o cliente',
  'Negócio perdido','Perdida','Cancelada','Gerada','Enviada','Aprovada'
));

alter table public.lead_quote_requests drop constraint if exists lead_quote_requests_status_check;
alter table public.lead_quote_requests add constraint lead_quote_requests_status_check check (status in (
  'Nova','Pendente','Em análise','Proposta gerada','Respondida','Encerrada',
  'Validação da proposta junto ao SPC Brasil',
  'Proposta enviada','Proposta fechada',
  'Validação dos dados SPC Brasil',
  'Aguardando envio da compra de leads do SPC Brasil',
  'Dados enviados ao cliente',
  'Compra de leads enviada para o cliente',
  'Negócio perdido'
));