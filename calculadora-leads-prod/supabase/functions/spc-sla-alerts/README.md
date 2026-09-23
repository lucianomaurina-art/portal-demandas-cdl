# Alertas SLA — Ordens SPC

Edge Function para avisar por e-mail quando uma etapa vence em até 24 horas ou está atrasada, quando o SLA total de 15 dias está próximo do vencimento ou vencido e quando chega a data do contato de pós-venda, 60 dias após o envio dos dados ao cliente.

## Segredos necessários

- `RESEND_API_KEY`: chave já usada pela CDL no Resend.
- `SPC_ALERT_CRON_SECRET`: segredo aleatório usado somente pelo agendador.
- `SPC_ALERT_TO`: destinatários separados por vírgula. Se omitido, usa `priscila@cdl-nh.com.br`.
- `SPC_ALERT_FROM`: opcional. Padrão: `SPC Dados CDL NH <spcdados@cdl-nh.com.br>`.
- `SPC_PORTAL_URL`: opcional. Padrão: portal atual no GitHub Pages.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizados pelo ambiente da Edge Function.

## Deploy

Nome da função: `spc-sla-alerts`.

Ela deve aceitar chamadas agendadas sem JWT da sessão do usuário e ser protegida pelo header `x-cron-secret`, com o mesmo valor de `SPC_ALERT_CRON_SECRET`.

## Agendamento

Recomendado: executar a cada hora. A própria função consulta `spc_data_order_sla` e usa `spc_data_order_alert_log` para impedir e-mails repetidos do mesmo tipo no mesmo dia.

Endpoint do projeto:

`https://uswsagujxwcfvauulhzq.supabase.co/functions/v1/spc-sla-alerts`

Enviar o header:

`x-cron-secret: <SPC_ALERT_CRON_SECRET>`

## Regras

- `Solicitar contagem`: prazo de 1 dia a partir do fechamento da proposta.
- `Contagem enviada ao SPC`: prazo de 7 dias para retorno do SPC.
- `Validar contagem`: prazo de 1 dia para validação CDL.
- `Aguardando planilha de dados`: prazo de 6 dias para entrega do SPC.
- SLA total: 15 dias corridos do fechamento da proposta até dados enviados ao cliente.
- Pós-venda: um único alerta 60 dias após `data_delivered_at`, para ordens movidas à coluna Pós-venda.

Alertas de SLA são enviados quando faltam até 24 horas ou quando o prazo já venceu. O alerta de pós-venda é enviado uma única vez.
