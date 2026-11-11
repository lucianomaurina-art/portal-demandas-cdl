# Ativação de Compras e OBZ no Portal CDL

## Escopo desta etapa

A área autenticada de Compras lista rascunhos, cria solicitações independentes ou ligadas a demandas e registra itens com centro, atividade, quantidade, unidade, necessidade, estimativa opcional e rubrica. O administrador do OBZ publica uma versão por centro aprovado. Os itens mantêm a referência histórica à versão usada.

## Banco e portal

1. No Supabase do Portal de Demandas, abra o SQL Editor. Execute o script de ativação entregue com este PR ou aplique, na ordem, apenas as três migrações abaixo. Escolha um método para esta instalação.
   - `20261111131000_demand_purchase_triage.sql`
   - `20261111133000_link_purchase_requests.sql`
   - `20261111144500_purchase_items_published_obz.sql`
2. O script único roda em uma transação e retorna uma consulta de conferência após o commit. A execução manual no SQL Editor instala os objetos sem registrar as versões no histórico da CLI. Se a equipe adotar a CLI posteriormente, concilie o histórico dessas três versões antes de executar `db push`.
3. Abra a branch `integracao/demandas-compras` em homologação. Para teste local, sirva a raiz dessa branch com `python3 -m http.server 8000` e abra `http://localhost:8000/#/compras`. O endereço do Supabase vem do `config.js` da branch.
4. Entre com um perfil interno ativo. Valide um rascunho independente e um a partir de demanda marcada como **Envolve compra**.
5. No OBZ, aprove um pacote real seguindo o fluxo de aprovação. Com perfil administrador do OBZ, abra **Compras e Contratações → Publicar orçamento aprovado para Compras**, selecione o centro e publique.
6. Abra um rascunho. Informe uma data do exercício publicado, selecione centro e rubrica e adicione um item. Verifique a rubrica, a versão e o item após recarregar. Teste também com um perfil interno sem permissão de publicação.

A consulta de centros aprovados pode retornar zero até a aprovação do primeiro pacote. Nenhum centro é aprovado pelo script. A fase de cotação, reserva, aprovação, ordens, recebimento e upload automático no Drive ainda está em desenvolvimento para o portal.
