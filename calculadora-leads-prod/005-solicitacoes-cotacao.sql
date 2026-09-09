-- 005 • Solicitações públicas de cotação SPC Dados
-- Executar no mesmo projeto Supabase da Calculadora de Leads.

create sequence if not exists public.lead_quote_request_seq start 1;

create table if not exists public.lead_quote_requests (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default ('SOL-' || lpad(nextval('public.lead_quote_request_seq')::text,6,'0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'Nova' check (status in ('Nova','Em análise','Proposta gerada','Respondida','Encerrada')),
  mode text not null check (mode in ('individual','combo')),
  person text not null check (person in ('Pessoa Física','Pessoa Jurídica')),
  quantity integer not null check (quantity > 0),
  client jsonb not null default '{}'::jsonb,
  selection jsonb not null,
  notes text,
  handled_by uuid references auth.users(id) on delete set null
);

alter table public.lead_quote_requests enable row level security;
revoke all on public.lead_quote_requests from anon;
grant select, update on public.lead_quote_requests to authenticated;

-- Usuários ativos do Portal Comercial podem visualizar e tratar solicitações.
drop policy if exists lead_quote_requests_staff_read on public.lead_quote_requests;
create policy lead_quote_requests_staff_read
on public.lead_quote_requests for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true));

drop policy if exists lead_quote_requests_staff_update on public.lead_quote_requests;
create policy lead_quote_requests_staff_update
on public.lead_quote_requests for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true));

-- Entrada pública: o navegador não recebe custos nem permissão de leitura da tabela.
create or replace function public.submit_lead_quote_request(
  p_mode text,
  p_person text,
  p_qty integer,
  p_client jsonb,
  p_selection jsonb,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.lead_quote_requests;
begin
  if p_mode not in ('individual','combo') then raise exception 'Modo inválido.'; end if;
  if p_person not in ('Pessoa Física','Pessoa Jurídica') then raise exception 'Tipo de pessoa inválido.'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantidade inválida.'; end if;
  if nullif(trim(coalesce(p_client->>'company','')), '') is null then raise exception 'Informe a empresa.'; end if;
  if nullif(trim(coalesce(p_client->>'contact','')), '') is null then raise exception 'Informe o contato.'; end if;
  if nullif(trim(coalesce(p_client->>'email','')), '') is null then raise exception 'Informe o e-mail.'; end if;
  if p_mode = 'individual' and jsonb_array_length(coalesce(p_selection,'[]'::jsonb)) = 0 then raise exception 'Selecione ao menos uma informação.'; end if;
  if p_mode = 'combo' and nullif(trim(coalesce(p_selection->>'level','')), '') is null then raise exception 'Selecione um combo.'; end if;

  insert into public.lead_quote_requests(mode,person,quantity,client,selection,notes)
  values(p_mode,p_person,p_qty,p_client,p_selection,nullif(trim(coalesce(p_notes,'')),''))
  returning * into r;

  return jsonb_build_object('id',r.id,'code',r.code,'created_at',r.created_at);
end;
$$;

revoke all on function public.submit_lead_quote_request(text,text,integer,jsonb,jsonb,text) from public;
grant execute on function public.submit_lead_quote_request(text,text,integer,jsonb,jsonb,text) to anon, authenticated;

-- Permissão necessária para salvar propostas autenticadas usando PROP-xxxxx.
grant usage, select on sequence public.lead_proposal_seq to authenticated;
