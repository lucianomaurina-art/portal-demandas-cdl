-- 006 • Kanban comercial + edição/exclusão administrativa
-- Execute uma vez no SQL Editor do Supabase após as migrações anteriores.

-- Propostas: novo funil comercial.
alter table public.lead_proposals drop constraint if exists lead_proposals_status_check;
alter table public.lead_proposals add constraint lead_proposals_status_check check (status in (
  'Rascunho','Pendente','Proposta enviada','Proposta fechada',
  'Aguardando envio da compra de leads do SPC Brasil',
  'Compra de leads enviada para o cliente','Perdida','Cancelada','Gerada','Enviada','Aprovada'
));

-- Solicitações: mesmo workflow para acompanhar a jornada até a entrega.
alter table public.lead_quote_requests drop constraint if exists lead_quote_requests_status_check;
alter table public.lead_quote_requests add constraint lead_quote_requests_status_check check (status in (
  'Nova','Pendente','Em análise','Proposta gerada','Respondida','Encerrada',
  'Proposta enviada','Proposta fechada',
  'Aguardando envio da compra de leads do SPC Brasil',
  'Compra de leads enviada para o cliente'
));

-- Normaliza registros antigos para as colunas atuais sem perder histórico.
update public.lead_quote_requests set status='Pendente' where status='Nova';
update public.lead_quote_requests set status='Pendente' where status='Em análise';
update public.lead_quote_requests set status='Proposta enviada' where status in ('Proposta gerada','Respondida');
update public.lead_proposals set status='Pendente' where status in ('Rascunho','Gerada');
update public.lead_proposals set status='Proposta enviada' where status='Enviada';
update public.lead_proposals set status='Proposta fechada' where status='Aprovada';

-- Exclusão de propostas: somente administrador CDL.
drop policy if exists lead_proposals_admin_delete on public.lead_proposals;
create policy lead_proposals_admin_delete on public.lead_proposals
for delete to authenticated using (public.is_cdl_admin());
grant delete on public.lead_proposals to authenticated;

-- Administrador pode editar qualquer proposta; a política de update já contempla is_cdl_admin().
-- Solicitações continuam editáveis pelos usuários ativos, conforme política da migração 005.
