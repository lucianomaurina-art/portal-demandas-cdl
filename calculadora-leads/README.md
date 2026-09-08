# Calculadora de Leads CDL Novo Hamburgo — Protótipo

Protótipo front-end baseado na planilha **Tabela Preços_SPC Dados_Entidades - 28.08.2025**.

## O que já funciona
- Login demonstrativo (não seguro para produção)
- Calculadora Individual: PF/PJ, faixas, seleção dos produtos/atributos
- Calculadora de Combos: Básico, Intermediário, Completo e Master para PF/PJ
- Atributos adicionais da aba Combos
- Markup e valor mínimo de venda
- Histórico local de propostas
- Proposta comercial em layout de impressão/PDF

## Regras replicadas
- Individual: custo <= R$ 2.500 → 100%; <= R$ 30.000 → 30%; acima → 15%
- Combos: custo <= R$ 2.500 → 100%; <= R$ 15.000 → 30%; acima → 15%
- Valor mínimo padrão: R$ 500

## Antes de produção
1. Conectar autenticação real (Supabase Auth).
2. Mover preços/perfis para banco ou endpoint protegido/Google Sheets backend.
3. Persistir propostas no banco, com controle de usuários.
4. Gerar PDF no servidor e implementar envio real por e-mail/WhatsApp.
5. Definir validade, condições comerciais e permissões de edição.
6. Confirmar política para atributos adicionais de combos: este protótipo soma os adicionais ao preço unitário do combo e aplica o markup sobre o custo total.

**Importante:** não inserir senhas reais no JavaScript/HTML público.
