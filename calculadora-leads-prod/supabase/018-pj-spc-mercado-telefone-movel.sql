-- Inclui Telefone Móvel na contratação individual do SPC Mercado para Pessoa Jurídica.
-- O custo segue o mesmo valor vigente de Telefone Fixo para este produto.
insert into public.lead_individual_prices(person,product,flag,prices)
values('Pessoa Jurídica','SPC Mercado','Telefone Móvel',ARRAY[0.05,0.05,0.04,0.03,0.03,0.02,0.02]::numeric[])
on conflict(person,product,flag) do update
set prices=excluded.prices,active=true,updated_at=now();
