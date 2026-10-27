const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const PORTAL_URL = 'https://cdl-nh.com.br/portal/demandas-e-ideias';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

async function readRest(path: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase REST ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Variáveis obrigatórias ausentes');
    return json({ error: 'Serviço de notificação não configurado' }, 500);
  }

  try {
    const payload = await req.json();
    const protocol = String(payload?.protocol ?? '').trim().toUpperCase();
    if (!/^D-\d{4,}$/.test(protocol)) return json({ error: 'Protocolo inválido' }, 400);

    const demands = await readRest(
      `demands?select=id,protocol,created_at,requester,email,nucleus,sector,description,expected_result,deadline,priority,notes,assignee_id,assignee&protocol=eq.${encodeURIComponent(protocol)}&limit=1`
    );
    const demand = demands?.[0];
    if (!demand) return json({ error: 'Demanda não encontrada' }, 404);

    const ageMs = Date.now() - new Date(demand.created_at).getTime();
    if (!Number.isFinite(ageMs) || ageMs < -60000 || ageMs > 60 * 60 * 1000) {
      return json({ error: 'A notificação só pode ser enviada logo após o cadastro' }, 409);
    }
    if (!demand.assignee_id) return json({ error: 'Demanda sem responsável vinculado' }, 422);

    const profiles = await readRest(
      `profiles?select=id,email,name,active&id=eq.${encodeURIComponent(demand.assignee_id)}&limit=1`
    );
    const recipient = profiles?.[0];
    if (!recipient?.active) {
      return json({ error: 'Responsável inativo ou não encontrado' }, 422);
    }

    let recipientEmail = String(recipient.email || '').trim();
    if (!recipientEmail) {
      const authResponse = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(demand.assignee_id)}`,
        {
          headers: {
            apikey: SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            Accept: 'application/json',
          },
        }
      );
      if (authResponse.ok) {
        const authUser = await authResponse.json();
        recipientEmail = String(authUser?.email || '').trim();
      }
    }
    if (!recipientEmail) {
      return json({ error: 'Responsável sem e-mail cadastrado' }, 422);
    }

    const recipientName = escapeHtml(recipient.name || demand.assignee || 'Responsável');
    const protocolHtml = escapeHtml(demand.protocol);
    const requester = escapeHtml(demand.requester);
    const sector = escapeHtml(demand.sector);
    const nucleus = escapeHtml(demand.nucleus);
    const description = escapeHtml(demand.description);
    const expectedResult = escapeHtml(demand.expected_result);
    const deadline = escapeHtml(
      new Date(`${demand.deadline}T12:00:00`).toLocaleDateString('pt-BR')
    );
    const priority = escapeHtml(demand.priority);
    const notes = escapeHtml(demand.notes || 'Sem observações');

    const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#17324d">
  <div style="max-width:680px;margin:0 auto;padding:28px 16px">
    <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #e3eaf1">
      <div style="font-size:13px;color:#66788a;margin-bottom:8px">CDL Novo Hamburgo • Portal de Demandas</div>
      <h1 style="font-size:24px;margin:0 0 8px">Nova demanda sob sua responsabilidade</h1>
      <p style="margin:0 0 24px;color:#52677a">Olá, ${recipientName}. Uma nova demanda foi direcionada para você.</p>
      <div style="display:inline-block;background:#edf4fb;border-radius:999px;padding:8px 12px;font-weight:700;margin-bottom:22px">${protocolHtml}</div>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#66788a;width:170px">Solicitante</td><td style="padding:8px 0;font-weight:600">${requester}</td></tr>
        <tr><td style="padding:8px 0;color:#66788a">Núcleo</td><td style="padding:8px 0">${nucleus}</td></tr>
        <tr><td style="padding:8px 0;color:#66788a">Setor</td><td style="padding:8px 0">${sector}</td></tr>
        <tr><td style="padding:8px 0;color:#66788a">Prioridade</td><td style="padding:8px 0">${priority}</td></tr>
        <tr><td style="padding:8px 0;color:#66788a">Prazo</td><td style="padding:8px 0">${deadline}</td></tr>
        <tr><td style="padding:8px 0;color:#66788a;vertical-align:top">Demanda</td><td style="padding:8px 0">${description}</td></tr>
        <tr><td style="padding:8px 0;color:#66788a;vertical-align:top">Resultado esperado</td><td style="padding:8px 0">${expectedResult}</td></tr>
        <tr><td style="padding:8px 0;color:#66788a;vertical-align:top">Observações</td><td style="padding:8px 0">${notes}</td></tr>
      </table>
      <div style="margin-top:26px">
        <a href="${PORTAL_URL}" style="display:inline-block;background:#123c68;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Abrir Portal de Demandas</a>
      </div>
      <p style="font-size:12px;color:#8a9bad;margin:26px 0 0">Mensagem automática. O envio repetido do mesmo protocolo é bloqueado.</p>
    </div>
  </div>
</body>
</html>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `cdl-nova-demanda-${demand.id}`,
      },
      body: JSON.stringify({
        from: 'Portal de Demandas CDL <spcdados@cdl-nh.com.br>',
        to: [recipientEmail],
        subject: `Nova demanda ${demand.protocol} — ${demand.priority}`,
        html,
      }),
    });

    const resendData = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('Erro Resend:', resendData);
      return json({ error: 'Falha no envio', details: resendData }, 502);
    }

    console.log('Notificação de demanda enviada', {
      protocol: demand.protocol,
      recipientId: recipient.id,
      resendId: resendData?.id,
    });
    return json({ ok: true, id: resendData?.id });
  } catch (error) {
    console.error('Erro ao notificar nova demanda:', error);
    return json({ error: 'Erro interno de notificação' }, 500);
  }
});
