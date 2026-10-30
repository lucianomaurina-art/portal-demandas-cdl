-- 016 • Corrige Matriz e Filial adicionadas fora do Combo PJ
-- Regra comercial: somente os atributos incluídos no Combo recebem o custo reduzido.
-- Adicionais contratados à parte seguem a tabela individual normal.
-- Execute no SQL Editor do Supabase após as migrações anteriores.

update public.lead_combo_addon_prices
set prices = ARRAY[0.05,0.05,0.04,0.03,0.03,0.02,0.02]::numeric[],
    active = true,
    updated_at = now()
where person = 'Pessoa Jurídica'
  and name in ('Matriz','Filial');

-- Conferência: as duas linhas devem retornar a tabela normal abaixo.
select person,name,prices,active
from public.lead_combo_addon_prices
where person = 'Pessoa Jurídica'
  and name in ('Matriz','Filial')
order by name;
