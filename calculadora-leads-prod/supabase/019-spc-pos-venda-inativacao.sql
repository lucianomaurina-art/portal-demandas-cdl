-- Protege a inativação de Ordens SPC: somente administradores podem mudar active.
create or replace function public.guard_spc_order_active_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.active is distinct from new.active
     and not exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
     ) then
    raise exception 'A inativação de Ordens SPC é exclusiva do administrador.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_spc_order_active_admin on public.spc_data_orders;
create trigger trg_guard_spc_order_active_admin
before update of active on public.spc_data_orders
for each row execute function public.guard_spc_order_active_admin();

create or replace function public.admin_set_spc_order_active(p_order_id uuid,p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
    raise exception 'Acesso não autorizado.';
  end if;
  update public.spc_data_orders set active=p_active where id=p_order_id;
end;
$$;

revoke all on function public.admin_set_spc_order_active(uuid,boolean) from public;
grant execute on function public.admin_set_spc_order_active(uuid,boolean) to authenticated;
