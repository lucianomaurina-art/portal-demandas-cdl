-- Migração: transforma uma ideia aprovada em uma única demanda vinculada.
alter table public.demands
  add column if not exists source_idea_id uuid references public.ideas(id) on delete set null,
  add column if not exists assignee_id uuid references public.profiles(id) on delete set null;

create unique index if not exists demands_source_idea_unique
on public.demands(source_idea_id)
where source_idea_id is not null;

alter table public.ideas
  add column if not exists implementation_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists linked_demand_id uuid references public.demands(id) on delete set null,
  add column if not exists linked_demand_protocol text;

create or replace function public.convert_idea_to_demand(p_idea_id uuid,p_owner_id uuid,p_project_name text,p_deadline date,p_priority text,p_expected_result text,p_notes text default null)
returns text language plpgsql security definer set search_path=public as $$
declare selected_idea public.ideas%rowtype;selected_owner public.profiles%rowtype;new_demand_id uuid;new_protocol text;
begin
  if not public.is_cdl_admin() then raise exception 'Apenas o administrador pode transformar uma ideia em demanda.';end if;
  select * into selected_idea from public.ideas where id=p_idea_id for update;
  if not found then raise exception 'Ideia não encontrada.';end if;
  if selected_idea.active=false then raise exception 'Uma ideia inativa não pode ser transformada em demanda.';end if;
  if selected_idea.linked_demand_id is not null or exists(select 1 from public.demands where source_idea_id=p_idea_id) then raise exception 'Esta ideia já possui uma demanda vinculada.';end if;
  select * into selected_owner from public.profiles where id=p_owner_id and active=true;
  if not found then raise exception 'Selecione um usuário ativo para implementar o projeto.';end if;
  if nullif(trim(selected_owner.sector),'') is null then raise exception 'O usuário escolhido precisa ter um setor definido no cadastro.';end if;
  if nullif(trim(p_project_name),'') is null or p_deadline is null or nullif(trim(p_expected_result),'') is null then raise exception 'Informe nome do projeto, prazo e resultado esperado.';end if;
  if p_priority not in ('Urgente','Alta','Média','Baixa') then raise exception 'Prioridade inválida.';end if;
  insert into public.demands(requester,email,nucleus,sector,description,expected_result,deadline,priority,assignee,assignee_id,notes,source_idea_id)
  values(selected_idea.author,selected_idea.email,'Outro',selected_owner.sector,trim(p_project_name)||' — '||selected_idea.title,trim(p_expected_result),p_deadline,p_priority,selected_owner.name,selected_owner.id,nullif(trim(p_notes),''),selected_idea.id)
  returning id,protocol into new_demand_id,new_protocol;
  update public.ideas set stage='Transformada em projeto',project_name=trim(p_project_name),reviewer=coalesce(nullif(reviewer,''),(select name from public.profiles where id=auth.uid())),implementation_owner_id=selected_owner.id,linked_demand_id=new_demand_id,linked_demand_protocol=new_protocol,updated_at=now() where id=selected_idea.id;
  return new_protocol;
end;$$;

revoke all on function public.convert_idea_to_demand(uuid,uuid,text,date,text,text,text) from public;
grant execute on function public.convert_idea_to_demand(uuid,uuid,text,date,text,text,text) to authenticated;
