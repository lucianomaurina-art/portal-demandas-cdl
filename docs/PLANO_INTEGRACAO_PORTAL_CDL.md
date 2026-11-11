# Portal Interno CDL Novo Hamburgo — Integração dos módulos
Atualizado em 11/11/2026.

## Estado atual verificado no repositório principal

O portal central encontra-se em `lucianomaurina-art/portal-demandas-cdl`.
A página inicial exibe os quatro módulos aprovados:

| Módulo | Acesso na home | Persistência e autorização |
| --- | --- | --- |
| Demandas | `#/nova` | Formulários e fluxo existentes; Supabase |
| Ideias e Inovação | `#/nova-ideia` | Formulários e fluxo existentes; Supabase |
| Orçamento Base Zero 2027 | GitHub Pages de homologação do OBZ | Base OBZ no mesmo projeto Supabase; a sessão em domínio externo pode exigir novo login |
| Compras e Contratações | `#/compras` | Entrada restrita à sessão interna; o Kanban incorporado continua sendo uma demonstração com dados no navegador |

A área `#/compras-triagem` utiliza `purchase_requests`, `purchase_request_items` e `purchase_quote_documents` no Supabase para operações persistidas, além da função `compras-cotacao-drive` para envio autenticado de cotações. A existência de tabelas e função ativa **não substitui testes reais de ponta a ponta**.

### Distinção obrigatória entre demonstração e operação integrada

O arquivo `compras/index.html` exibe um seletor de **perfil de teste** e guarda alterações em `localStorage`, de modo que decisões, fornecedores e ordens desse protótipo não constituem registros oficiais. A interface principal precisa deixar essa condição explícita. Não prometer autorização real, assinatura digital, sincronização com o Supabase ou recuperação multiusuário dentro do Kanban de demonstração.

A operação real começa em `#/compras-triagem` e deve ser validada por perfis distintos, com arquivos de exemplo. Até confirmação da persistência de cada etapa, não se deve declarar o fluxo completo como concluído para uso oficial.

## Limites e dependências

- Os quatro cartões foram aprovados visualmente pela gestão.
- A autenticação da **área interna do portal** usa o mesmo Supabase de Demandas/Ideias.
- O OBZ é acessado por endereço externo do GitHub Pages; sessão única entre origens ainda não foi implantada.
- A previsão orçamentária do OBZ 2027 não deve ser automaticamente considerada saldo disponível para compras.
- Não alterar versões financeiras aprovadas nem as políticas de acesso sem migrações versionadas, revisão de segurança e testes por perfil.
- Integração futura precisa registrar relação entre demanda, compra, centro/rubrica OBZ, reserva, comprometimento e realizado, sem dupla contabilização.

## Critérios de homologação da página inicial

- [x] Quatro cartões exibidos no código da home.
- [x] Rotas existentes de Demandas e Ideias preservadas.
- [x] Link do OBZ 2027 aponta para homologação.
- [x] Compras utiliza a rota autenticada do mesmo portal.
- [x] Área demonstrativa e área integrada claramente diferenciadas no código.
- [x] CSS do novo portal restrito à página inicial.
- [ ] Testar em navegador autenticado: desktop, celular, login, logout e carregamento dos quatro módulos.
- [ ] Testar em navegador autenticado: usuário sem perfil ativo não acessa compras integradas.
- [ ] Testar com dados fictícios: solicitação, itens, cotação/Drive, permissões, histórico e reabertura.
- [ ] Validar a página `https://cdl-nh.com.br/portal/demandas-e-ideias` após atualização do site que incorpora o portal, se aplicável.

## Governança de atualizações

1. Toda alteração nasce em branch isolada, registrada em pull request.
2. Não desfazer mudanças de outro módulo com merges de branches antigas.
3. Exigir revisão do diff, testes automáticos e verificação do estado do banco antes do merge.
4. Separar publicação visual, alterações de acesso e migrações financeiras.
5. Atualizar a documentação e controlar as versões dos scripts servidos na página.
6. Para regressões, voltar ao commit anterior sem excluir dados.
7. Futuramente, construir skills do agente de manutenção com permissões mínimas e regras de aprovação explícitas.

## Próxima evolução, fora da integração visual

- Persistir o fluxo completo do Kanban de Compras no banco, com estados, fornecedores, seleção, ordens, recebimentos e documentos.
- Vincular regras de alçada real e eventual assinatura de ordens.
- Implementar integração transacional com orçamento publicado do OBZ.
- Homologar o uso real de todas as permissões e interfaces.
- Avaliar hospedagem na mesma origem para permitir navegação contínua e reduzir necessidade de login adicional no OBZ.

## Arquivos relevantes

- `index.html`: página inicial e seção de Compras.
- `portal-modules.css`: estilos isolados da home.
- `app.js`: roteamento e acesso autenticado às solicitações de Compras.
- `compras/index.html`: protótipo de Kanban com dados locais.
- `tests/portal-unificado.test.mjs`: regressões da home.
