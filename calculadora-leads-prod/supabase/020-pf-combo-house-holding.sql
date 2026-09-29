-- Disponibiliza House Holding como adicional dos combos para Pessoa Física.
-- A tabela de custos é a mesma já utilizada na contratação individual.
insert into public.lead_combo_addon_prices(person,name,prices)
values('Pessoa Física','House Holding',ARRAY[0.34,0.34,0.22,0.17,0.16,0.15,0.14]::numeric[])
on conflict(person,name) do update
set prices=excluded.prices,active=true,updated_at=now();
