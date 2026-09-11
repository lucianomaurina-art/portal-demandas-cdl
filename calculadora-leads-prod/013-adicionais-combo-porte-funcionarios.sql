-- 013 • Adicionais híbridos de Combo PJ
-- Inclui Porte e Numero de Funcionarios como atributos adicionais de Combo.
-- Os custos seguem a tabela validada do SPC Mercado para os mesmos atributos,
-- permitindo complementar um Combo quando essas flags forem solicitadas pelo cliente.

insert into public.lead_combo_addon_prices(person,name,prices)
values(
  'Pessoa Jurídica',
  'Porte',
  ARRAY[0.16,0.16,0.15,0.15,0.14,0.14,0.13]::numeric[]
)
on conflict(person,name) do update
set prices=excluded.prices,
    active=true,
    updated_at=now();

insert into public.lead_combo_addon_prices(person,name,prices)
values(
  'Pessoa Jurídica',
  'Numero de Funcionarios',
  ARRAY[0.16,0.16,0.15,0.15,0.14,0.14,0.13]::numeric[]
)
on conflict(person,name) do update
set prices=excluded.prices,
    active=true,
    updated_at=now();
