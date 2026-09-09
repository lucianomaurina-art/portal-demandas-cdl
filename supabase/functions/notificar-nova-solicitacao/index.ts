const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const DESTINATARIO = 'priscila@cdl-nh.com.br';
const REMETENTE = 'SPC Dados | CDL Novo Hamburgo <spcdados@cdl-nh.com.br>';
const PORTAL_URL = 'https://lucianomaurina-art.github.io/portal-demandas-cdl/calculadora-leads-prod/';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function desiredData(selection: unknown) {
  if (!selection) return 'Não informado';
  if (Array.isArray(selection)) {
    const items = selection
      .map((item: any) => item?.flag || item?.name || item?.attribute)
      .filter(Boolean);
    return items.length ? items.join(', ') : 'Não informado';
  }
  if (typeof selection === 'object') {
    const obj = selection as Record<string, unknown>;
    const combo = obj.combo ? `Combo: ${obj.combo}` : '';
    const extras = Array.isArray(obj.addons)
      ? (obj.addons as any[]).map(x => x?.flag || x?.name || x).filter(Boolean).join(', ')
      : '';
    return [combo, extras ? `Adicionais: ${extras}` : ''].filter(Boolean).join(' — ') || 'Não informado';
  }
  return String(selection);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY não configurada');
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurada' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json();
    const record = payload?.record ?? payload;
    const client = record?.client ?? {};

    if (!record?.code) {
      return new Response(JSON.stringify({ error: 'Solicitação inválida: código ausente' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const code = escapeHtml(record.code);
    const company = escapeHtml(client.company || 'Não informado');
    const contact = escapeHtml(client.contact || 'Não informado');
    const email = escapeHtml(client.email || 'Não informado');
    const phone = escapeHtml(client.phone || 'Não informado');
    const doc = escapeHtml(client.doc || 'Não informado');
    const need = escapeHtml(client.need || client.objective || 'Não informado');
    const existingData = escapeHtml(client.existing_data || 'Não informado');
    const person = escapeHtml(record.person || 'Não informado');
    const qty = escapeHtml(record.qty ?? record.quantity ?? 'Não informado');
    const notes = escapeHtml(record.notes || 'Sem observações');
    const selection = escapeHtml(desiredData(record.selection));

    const html = `
      <!doctype html>
      <html lang="pt-BR">
      <body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#222;">
        <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
          <div style="background:#ffffff;border-radius:16px;padding:28px;box-shadow:0 4px 18px rgba(0,0,0,.06);">
            <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">CDL Novo Hamburgo • SPC Dados</div>
            <h1 style="font-size:24px;margin:0 0 8px;">Nova solicitação de cotação</h1>
            <p style="margin:0 0 24px;color:#555;">Uma nova solicitação entrou no Portal Comercial.</p>

            <div style="display:inline-block;background:#eef2ff;border-radius:999px;padding:8px 12px;font-weight:700;margin-bottom:22px;">${code}</div>

            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 0;color:#6b7280;width:180px;">Empresa</td><td style="padding:8px 0;font-weight:600;">${company}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Contato</td><td style="padding:8px 0;">${contact}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">E-mail</td><td style="padding:8px 0;">${email}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Telefone</td><td style="padding:8px 0;">${phone}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">CNPJ/CPF</td><td style="padding:8px 0;">${doc}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Perfil</td><td style="padding:8px 0;">${person}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Volume</td><td style="padding:8px 0;">${qty}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Necessidade</td><td style="padding:8px 0;">${need}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Dados já existentes</td><td style="padding:8px 0;">${existingData}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Dados desejados</td><td style="padding:8px 0;">${selection}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Observações</td><td style="padding:8px 0;">${notes}</td></tr>
            </table>

            <div style="margin-top:26px;">
              <a href="${PORTAL_URL}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700;">Abrir Portal Comercial</a>
            </div>

            <p style="font-size:12px;color:#9ca3af;margin:26px 0 0;">Mensagem automática gerada pelo Portal Comercial da CDL Novo Hamburgo.</p>
          </div>
        </div>
      </body>
      </html>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: REMETENTE,
        to: [DESTINATARIO],
        subject: `Nova solicitação de cotação ${record.code} — ${client.company || 'Portal CDL'}`,
        html,
      }),
    });

    const resendData = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('Erro Resend:', resendData);
      return new Response(JSON.stringify({ error: 'Falha no envio', details: resendData }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Notificação enviada:', { code: record.code, resendId: resendData?.id });
    return new Response(JSON.stringify({ ok: true, id: resendData?.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro inesperado:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
