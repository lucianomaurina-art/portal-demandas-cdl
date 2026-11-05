-- OBZ 2027 hardening: manager may change only justifications/alternatives,
-- while monetary values remain administrator-controlled.
-- This migration supersedes direct obz_lines UPDATE policies from initial MVP.
drop policy if exists obz_lines_admin_update on public.obz_lines;
create policy obz_lines_admin_update on public.obz_lines for update to authenticated
 using(public.obz_is_admin()) with check(public.obz_is_admin());

create or replace function public.obz_update_justification(
 p_line uuid, p_justification text, p_alternative text
) returns void language plpgsql security definer set search_path=public as $$
declare v_center uuid; v_status text;
begin
 select l.center_id,c.status into v_center,v_status
 from public.obz_lines l join public.obz_centers c on c.id=l.center_id
 where l.id=p_line for update of l;
 if not found then raise exception 'Rubrica inexistente'; end if;
 if not public.obz_can_manage(v_center) then raise exception 'Acesso negado'; end if;
 if not public.obz_is_admin() and v_status not in ('draft','changes_requested') then
   raise exception 'Pacote bloqueado para edição';
 end if;
 if length(coalesce(p_justification,''))>4000 or length(coalesce(p_alternative,''))>4000 then
   raise exception 'Texto excede limite';
 end if;
 update public.obz_lines set justification=coalesce(p_justification,''),
 alternative=coalesce(p_alternative,''),updated_by=auth.uid(),updated_at=now()
 where id=p_line;
end; $$;
revoke all on function public.obz_update_justification(uuid,text,text) from public,anon;
grant execute on function public.obz_update_justification(uuid,text,text) to authenticated;

-- Enforce financial edits by admin even if a future policy is loosened.
create or replace function public.obz_guard_financial_changes()
returns trigger language plpgsql set search_path=public as $$
begin
 if (new.months is distinct from old.months or new.category is distinct from old.category
 or new.center_id is distinct from old.center_id or new.source_key is distinct from old.source_key)
 and not public.obz_is_admin() then
   raise exception 'Somente administrador pode alterar valores ou vinculação da rubrica';
 end if;
 return new;
end; $$;
drop trigger if exists obz_guard_financial_changes on public.obz_lines;
create trigger obz_guard_financial_changes before update on public.obz_lines
for each row execute function public.obz_guard_financial_changes();

-- Block authenticated direct edits to center status: use audited RPC instead.
drop policy if exists obz_centers_admin_update on public.obz_centers;
-- Administrators update assignments via dedicated RPC.
create or replace function public.obz_assign_manager(p_center uuid,p_manager uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.obz_is_admin() then raise exception 'Acesso negado'; end if;
 if p_manager is not null and not exists(
   select 1 from public.profiles where id=p_manager and active=true
 ) then raise exception 'Gestor inativo ou inexistente'; end if;
 update public.obz_centers set manager_id=p_manager,updated_at=now() where id=p_center;
 if not found then raise exception 'Pacote inexistente'; end if;
 insert into public.obz_audit(center_id,actor_id,action,new_value)
 values(p_center,auth.uid(),'manager_assignment',jsonb_build_object('manager_id',p_manager));
end; $$;
revoke all on function public.obz_assign_manager(uuid,uuid) from public,anon;
grant execute on function public.obz_assign_manager(uuid,uuid) to authenticated;

-- Imported line data must be written via administrator-only function, not service-role in browser.
create or replace function public.obz_import_lines(p_center uuid,p_lines jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare item jsonb; n int:=0; v_months numeric(16,2)[]; v_key text; v_type text;
begin
 if not public.obz_is_admin() then raise exception 'Acesso negado'; end if;
 if not exists(select 1 from public.obz_centers where id=p_center and status='draft' for update) then
   raise exception 'Importação permitida apenas em pacote rascunho';
 end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)>1000 then
   raise exception 'Lote inválido';
 end if;
 for item in select value from jsonb_array_elements(p_lines) loop
   v_key:=nullif(trim(item->>'source_key'),'');
   v_type:=item->>'category';
   select array_agg(value::numeric(16,2) order by ord) into v_months
   from jsonb_array_elements_text(item->'months') with ordinality as t(value,ord);
   if v_key is null or v_type not in ('revenue','expense')
     or coalesce(array_length(v_months,1),0)<>12
     or nullif(trim(item->>'description'),'') is null then
     raise exception 'Rubrica inválida: %',coalesce(v_key,'sem código');
   end if;
   insert into public.obz_lines(center_id,source_key,category,description,account_code,months,updated_by)
   values(p_center,v_key,v_type,item->>'description',item->>'account_code',v_months,auth.uid())
   on conflict(center_id,source_key) do update set
     category=excluded.category,description=excluded.description,account_code=excluded.account_code,
     months=excluded.months,updated_by=auth.uid(),updated_at=now();
   n:=n+1;
 end loop;
 insert into public.obz_audit(center_id,actor_id,action,new_value)
 values(p_center,auth.uid(),'import',jsonb_build_object('rows',n));
 return n;
end; $$;
revoke all on function public.obz_import_lines(uuid,jsonb) from public,anon;
grant execute on function public.obz_import_lines(uuid,jsonb) to authenticated;
