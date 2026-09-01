# Portal de Demandas — CDL Novo Hamburgo

Portal público e responsivo para registro de demandas dos núcleos e setores da CDL Novo Hamburgo.

## Arquitetura

- GitHub Pages: interface pública
- Google Apps Script: receptor dos envios
- Google Planilhas: base e plano de ação

## Configuração da integração

Edite a constante `APPS_SCRIPT_URL` em `index.html` e informe a URL ativa da implantação do Google Apps Script, terminada em `/exec`.

Enquanto a URL estiver vazia, o portal não envia dados e informa claramente que a integração aguarda ativação.
