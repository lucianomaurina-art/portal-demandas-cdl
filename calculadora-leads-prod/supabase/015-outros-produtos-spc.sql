-- 015 - Outros Produtos SPC
-- Cadastro interno protegido e cálculo comercial server-side.

create table if not exists public.spc_other_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_cost numeric(14,6) not null check (unit_cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spc_other_products enable row level security;
revoke all on public.spc_other_products from anon, authenticated;

-- Apenas administradores podem manter/consultar custos diretamente.
create policy "spc_other_products_admin_all"
on public.spc_other_products
for all
to authenticated
using (exists (select 1 from public.portal_users u where u.user_id = auth.uid() and u.role = 'admin' and coalesce(u.active,true)))
with check (exists (select 1 from public.portal_users u where u.user_id = auth.uid() and u.role = 'admin' and coalesce(u.active,true)));

grant select, insert, update, delete on public.spc_other_products to authenticated;

-- Catálogo seguro para a calculadora: não retorna custo.
create or replace function public.list_spc_other_products()
returns table(id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name
  from public.spc_other_products p
  where p.active = true
  order by p.name;
$$;
revoke all on function public.list_spc_other_products() from public;
grant execute on function public.list_spc_other_products() to authenticated;

-- Calcula preço comercial sem expor custo no modo cliente.
-- Mesma política vigente: até 2.500 = 100%; até 30.000 = 70%; acima = 50%.
create or replace function public.calculate_spc_other_product(p_product_id uuid, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_cost numeric;
  v_total_cost numeric;
  v_markup numeric;
  v_sale_unit numeric;
  v_sale_total numeric;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantidade inválida'; end if;
  select name, unit_cost into v_name, v_cost from public.spc_other_products where id=p_product_id and active=true;
  if v_name is null then raise exception 'Produto não encontrado'; end if;
  v_total_cost := v_cost * p_qty;
  v_markup := case when v_total_cost <= 2500 then 1.00 when v_total_cost <= 30000 then 0.70 else 0.50 end;
  v_sale_unit := v_cost * (1 + v_markup);
  v_sale_total := v_sale_unit * p_qty;
  return jsonb_build_object('id',p_product_id,'name',v_name,'commercial_unit',v_sale_unit,'sale_total',v_sale_total,'quantity',p_qty);
end;
$$;
revoke all on function public.calculate_spc_other_product(uuid,integer) from public;
grant execute on function public.calculate_spc_other_product(uuid,integer) to authenticated;

-- Visão interna separada, somente admin, com custo e markup.
create or replace function public.calculate_spc_other_product_internal(p_product_id uuid, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text; v_cost numeric; v_total_cost numeric; v_markup numeric; v_sale_unit numeric; v_sale_total numeric;
begin
  if not exists (select 1 from public.portal_users u where u.user_id=auth.uid() and u.role='admin' and coalesce(u.active,true)) then raise exception 'Acesso não autorizado'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantidade inválida'; end if;
  select name,unit_cost into v_name,v_cost from public.spc_other_products where id=p_product_id and active=true;
  if v_name is null then raise exception 'Produto não encontrado'; end if;
  v_total_cost:=v_cost*p_qty;
  v_markup:=case when v_total_cost<=2500 then 1.00 when v_total_cost<=30000 then 0.70 else 0.50 end;
  v_sale_unit:=v_cost*(1+v_markup); v_sale_total:=v_sale_unit*p_qty;
  return jsonb_build_object('id',p_product_id,'name',v_name,'unit_cost',v_cost,'cost_total',v_total_cost,'markup',v_markup,'commercial_unit',v_sale_unit,'sale_total',v_sale_total,'quantity',p_qty);
end;
$$;
revoke all on function public.calculate_spc_other_product_internal(uuid,integer) from public;
grant execute on function public.calculate_spc_other_product_internal(uuid,integer) to authenticated;
