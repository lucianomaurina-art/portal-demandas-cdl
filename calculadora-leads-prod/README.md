# Calculadora de Leads — versão de produção

Esta pasta contém a versão preparada para uso real da CDL Novo Hamburgo.

## Segurança
- Login usa Supabase Auth já configurado no repositório.
- A tabela de custos SPC **não é enviada ao navegador**.
- O cálculo comercial é feito por RPC `calculate_lead_quote` no Supabase.
- A visão interna exige nova autenticação e usa RPC separada.
- Propostas são salvas por usuário com RLS.

## Ativação
1. Abrir o SQL Editor do projeto Supabase já utilizado pelo Portal de Demandas.
2. Executar `supabase-calculadora.sql` uma única vez.
3. Garantir que os vendedores tenham usuários ativos em `auth.users` / `public.profiles`.
4. Abrir a página `calculadora-leads-prod/` pelo GitHub Pages.

## Regra de markup
Individual: até R$ 2.500 de custo = 100%; até R$ 30.000 = 30%; acima = 15%.
Combos: até R$ 2.500 de custo = 100%; até R$ 15.000 = 30%; acima = 15%.

O mínimo comercial de R$ 500 é apenas lembrete interno e não participa de nenhum cálculo.
