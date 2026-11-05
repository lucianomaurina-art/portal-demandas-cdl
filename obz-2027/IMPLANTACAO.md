# Implantação segura — OBZ 2027

## Entregue nesta branch
- `obz-2027/index.html`: simulador demonstrativo, sem persistência.
- `obz-2027/gestao.html`: login Supabase, leitura por centro, edição de rubricas, justificativas, tramitação e histórico.
- `supabase/migrations/20261105_obz_2027.sql`: tabelas isoladas, RLS, função de transição e auditoria.

## Pré-requisitos de ativação
1. Revisar e executar a migração SQL no Supabase da CDL em ambiente de homologação. **Ainda não executada.**
2. Conferir `profiles`: usuários ativos, função `admin` e cadastro da Priscila.
3. Atribuir à Priscila o centro SPC Brasil com SQL executado por administrador:
   `update public.obz_centers set manager_id=(select id from public.profiles where lower(email)=lower('EMAIL_REAL_DA_PRISCILA') limit 1) where code='SPC_BRASIL';`
   Substituir o marcador pelo e-mail correto, sem publicar e-mails em código.
4. Importar as rubricas de `Orçamento 2027` (meses G:R, 12 valores numéricos por rubrica), usando um processo **server-side autenticado**, com conta de serviço ou integração OAuth. Não usar chave de serviço no navegador, no GitHub ou em planilhas compartilhadas.
5. Mapear `source_key` de modo estável (ex.: `OBZ2027:SPC:410`), excluir linhas de subtotal/resultado, classificar receita e despesa, e usar UPSERT transacional após reconciliação.
6. Reconciliação obrigatória antes de disponibilizar: SPC receita bruta 3.531.684,84; receita líquida 3.483.771,84; despesa 3.059.212,62; resultado 424.559,22. Valores são fotografia de 05/11/2026, não garantem atualizações futuras.
7. Testar com três contas reais em homologação: admin vê todos os centros; Priscila vê/edita somente SPC Brasil; outro gestor não acessa SPC Brasil nem seu histórico. Testar status e bloqueio de edição.
8. Só então mesclar o PR, publicar e adicionar menu na Plataforma de Demandas.

## Segurança e limites
- O painel demonstrativo contém valores anuais estáticos e é público se a branch for publicada. Não usar para dados confidenciais.
- A área autenticada só funciona depois da migração e importação.
- A conexão Google Planilhas → Supabase ainda **não está implementada**. A planilha da Priscila continua vinculada à Mestra, não à nova base.
- O fluxo não cria contas automaticamente, não executa migração SQL nem altera permissões de usuários existentes.
- O domínio OBZ não altera tabelas e permissões do portal de demandas.
