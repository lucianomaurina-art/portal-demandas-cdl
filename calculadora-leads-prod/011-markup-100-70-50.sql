-- 011 • Nova política comercial de markup: 100%, 70% e 50%
-- Execute no SQL Editor do Supabase após as migrações anteriores.

create or replace function public.calculate_lead_quote_base(p_mode text,p_person text,p_qty integer,p_selection jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b integer;u numeric:=0;c numeric:=0;m numeric:=0;s numeric:=0;rec record;out_items jsonb:='[]'::jsonb;sel jsonb;combo_level text;addon text;
begin
  if auth.uid() is null then raise exception 'Acesso não autenticado.';end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and active=true) then raise exception 'Usuário inativo.';end if;
  if p_mode not in ('individual','combo') or p_qty<=0 or p_person not in ('Pessoa Física','Pessoa Jurídica') then raise exception 'Parâmetros inválidos.';end if;
  b:=public.lead_band_index(p_qty,p_mode);
  if p_mode='individual' then
    for sel in select * from jsonb_array_elements(coalesce(p_selection,'[]'::jsonb)) loop
      select product,flag,prices[b] unit into rec from public.lead_individual_prices where active and person=p_person and product=sel->>'product' and flag=sel->>'flag';
      if found then u:=u+rec.unit;out_items:=out_items||jsonb_build_array(jsonb_build_object('name',rec.product||' — '||rec.flag,'unit_cost',rec.unit));end if;
    end loop;
  else
    combo_level:=p_selection->>'level';
    select level,prices[b] unit,items into rec from public.lead_combo_prices where active and person=p_person and level=combo_level;
    if found then u:=u+rec.unit;out_items:=out_items||jsonb_build_array(jsonb_build_object('name','Combo '||rec.level,'unit_cost',rec.unit,'details',rec.items));end if;
    for addon in select jsonb_array_elements_text(coalesce(p_selection->'addons','[]'::jsonb)) loop
      select name,prices[b] unit into rec from public.lead_combo_addon_prices where active and person=p_person and name=addon;
      if found then u:=u+rec.unit;out_items:=out_items||jsonb_build_array(jsonb_build_object('name','Adicional — '||rec.name,'unit_cost',rec.unit));end if;
    end loop;
  end if;
  c:=u*p_qty;
  if c>0 then
    m:=case
      when c<=2500 then 1.00
      when p_mode='combo' and c<=15000 then .70
      when p_mode='individual' and c<=30000 then .70
      else .50
    end;
  end if;
  s:=c*(1+m);
  return jsonb_build_object('mode',p_mode,'person',p_person,'quantity',p_qty,'band',public.lead_band_label(p_qty,p_mode),'unit_cost',round(u,4),'cost_total',round(c,2),'markup',m,'sale_total',round(s,2),'sale_unit',case when p_qty>0 then round(s/p_qty,4) else 0 end,'items',out_items);
end;$$;

revoke all on function public.calculate_lead_quote_base(text,text,integer,jsonb) from public;
