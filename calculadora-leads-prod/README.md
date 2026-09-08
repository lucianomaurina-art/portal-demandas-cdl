# Calculadora de Leads — versão de produção

Esta pasta contém a versão preparada para uso real da CDL Novo Hamburgo.

## Segurança
- Login usa o Supabase Auth já configurado no Portal de Demandas.
- A tabela de custos SPC **não é enviada ao navegador**.
- O cálculo comercial é executado no Supabase pela RPC `calculate_lead_quote`.
- A visão interna exige nova autenticação e usa a RPC separada `calculate_lead_quote_internal`.
- Propostas e simulações são salvas por usuário com Row Level Security (RLS).
- O catálogo público contém somente nomes de produtos, atributos e composição dos combos — sem custos.

## Ativação no Supabase
Abra o **SQL Editor** do mesmo projeto Supabase utilizado pelo Portal de Demandas e execute os arquivos abaixo, nesta ordem:

1. `001-schema.sql`
2. `002-01-precos-individuais.sql`
3. `002-02-precos-individuais.sql`
4. `002-03-precos-individuais.sql`
5. `002-04-precos-individuais.sql`
6. `003-01-precos-combos.sql`
7. `003-02-precos-combos.sql`
8. `004-verificacao.sql`

O arquivo `004-verificacao.sql` deve retornar:
- **106** registros individuais ativos;
- **8** combos ativos;
- **42** atributos adicionais ativos;
- `Data de Fundação / Pessoa Jurídica / SPC Enriquece` = **R$ 0,05** na primeira faixa.

Depois da migração, garanta que os vendedores possuam usuários ativos no Supabase (`auth.users`) e em `public.profiles`.

## Regra de markup validada
**Individual**
- custo total até R$ 2.500: 100%;
- acima de R$ 2.500 até R$ 30.000: 30%;
- acima de R$ 30.000: 15%.

**Combos**
- custo total até R$ 2.500: 100%;
- acima de R$ 2.500 até R$ 15.000: 30%;
- acima de R$ 15.000: 15%.

## Contratação mínima
O valor mínimo comercial de **R$ 500** é apenas um lembrete na visão interna. Ele **não participa de nenhum cálculo**, não é rateado por lead e não altera automaticamente o valor da proposta.

## Interface
A aplicação abre sempre em **Modo Cliente**. Custos e markup só aparecem quando o vendedor aciona a **Visão interna** e confirma novamente sua senha. A seleção individual funciona como um construtor: escolhe-se um produto e são mostrados somente seus atributos; outros produtos podem ser adicionados conforme necessário.
