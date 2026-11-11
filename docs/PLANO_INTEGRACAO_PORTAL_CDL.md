# Portal Interno CDL — Integração progressiva dos módulos

## Estado desta implementação (11/11/2026)
- Branch de homologação: `feature/portal-unificado-home-2027`
- Escopo: página inicial do repositório `portal-demandas-cdl`.
- Não altera banco de dados, autenticação, roteamento nem as telas internas de Demandas e Ideias.
- Mantém `#/nova` e `#/nova-ideia` exatamente como no portal existente.
- Acrescenta acesso ao OBZ 2027 em homologação: `https://lucianomaurina-art.github.io/cdl-obz-2027-homologacao/`.
- Exibe Compras e Contratações como *Em desenvolvimento* (sem link ativo).
- A navegação para o OBZ abre outra aba. **Sessão única entre domínios NÃO está implementada**; cada módulo faz suas próprias verificações de acesso.

## Regras de evolução
1. Preservar o portal em produção até que o usuário aprove a alteração.
2. Trabalhar em branch específica, com pull request e revisão do diff.
3. Manter rotas anteriores funcionando. Não duplicar tabelas ou usuários.
4. Nenhuma alteração de RLS, permissões, fluxos de aprovação ou despesas orçamentárias será embutida numa mudança puramente visual.
5. Compras só ganhará link após existir um endereço homologado e a equipe aprovar o módulo.
6. Na futura integração de dados, vincular demandas, solicitações de compra, rubricas e compromissos através de identificadores imutáveis; separar previsão, reserva, comprometido e realizado.
7. Integrar autenticação/domínios em atividade separada, com testes de sessão, logout, redirecionamentos, RLS e fluxos de acesso.
8. Cada solicitação futura deverá indicar: módulo/tela, problema observado, comportamento esperado, impactos que devem ser preservados e critério de aceite.
9. Tratar falhas de atualização com rollback, e controlar migrações de banco por etapas.
10. Elaborar as skills do agente de manutenção **após** estabilização de Compras, conforme decisão da gestão.

## Critérios de aceite da primeira fase
- [ ] Tela inicial exibe quatro cartões em desktop e mobile, sem sobreposição.
- [ ] Demandas abre o cadastro atual e continua registrando solicitações.
- [ ] Ideias abre o cadastro atual e continua registrando ideias.
- [ ] OBZ abre numa nova aba e exige autenticação/autorizações próprias.
- [ ] Compras exibe estado Em desenvolvimento e não conduz a uma rota incompleta.
- [ ] Usuário consegue retornar à tela inicial pelo logo.
- [ ] Topbar, rotas administrativas, dashboard, notificações e logout permanecem inalterados.
- [ ] Publicação em produção somente após validação da gestão.

## Etapas posteriores — fora deste PR
1. Concluir e homologar Compras e Contratações.
2. Publicar o acesso de Compras no cartão correto.
3. Estudar hospedagem comum sob `cdl-nh.com.br/portal` e sessão integrada; validar riscos de domínios diferentes.
4. Integrar a criação de solicitações de compras a partir de demandas e vinculação de centros/rubricas do OBZ.
5. Parametrizar e homologar alçadas, limites, reserva orçamentária e auditoria.
6. Somente então criar skills restritas do agente de manutenção, com permissões mínimas e política de mudanças controladas.

## Arquivos alterados
- `index.html`: conteúdo do acesso inicial e referência ao CSS de módulos.
- `portal-modules.css`: estilos isolados da tela inicial.
- `docs/PLANO_INTEGRACAO_PORTAL_CDL.md`: este plano de interface e evolução futura.
