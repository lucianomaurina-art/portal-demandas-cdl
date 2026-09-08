-- 004 • Verificação pós-migração da Calculadora de Leads
-- Resultado esperado: 106 individuais, 8 combos, 42 adicionais.
select
  (select count(*) from public.lead_individual_prices where active=true) as individuais,
  (select count(*) from public.lead_combo_prices where active=true) as combos,
  (select count(*) from public.lead_combo_addon_prices where active=true) as adicionais;

-- Conferência pontual importante: Data de Fundação PJ deve custar R$ 0,05 na primeira faixa individual.
select person,product,flag,prices[1] as primeira_faixa
from public.lead_individual_prices
where person='Pessoa Jurídica' and product='SPC Enriquece' and flag='Data de Fundação';

-- Combos de referência.
select person,level,prices[1] as primeira_faixa
from public.lead_combo_prices
where (person='Pessoa Física' and level='Básico')
   or (person='Pessoa Física' and level='Master')
   or (person='Pessoa Jurídica' and level='Master')
order by person,level;
