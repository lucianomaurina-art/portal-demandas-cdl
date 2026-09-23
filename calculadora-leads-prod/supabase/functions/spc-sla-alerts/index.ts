import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TZ = 'America/Sao_Paulo';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
const dateKey = (d = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const fmt = (v: string | null) => v ? new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,dateStyle:'short',timeStyle:'short'}).format(new Date(v)) : '—';
const addDays = (v: string | null,n: number) => v ? new Date(new Date(v).getTime()+n*86400000) : null;

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get('SPC_ALERT_CRON_SECRET');
    const supplied = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (!cronSecret) return new Response('SPC_ALERT_CRON_SECRET não configurado.',{status:500});
    if (supplied !== cronSecret) return new Response('Não autorizado.',{status:401});

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !serviceKey || !resendKey) {
      return new Response('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou RESEND_API_KEY ausente.',{status:500});
    }

    const recipients = (Deno.env.get('SPC_ALERT_TO') || 'priscila@cdl-nh.com.br')
      .split(',').map(x=>x.trim()).filter(Boolean);
    const recipientKey = recipients.join(',');
    const from = Deno.env.get('SPC_ALERT_FROM') || 'SPC Dados CDL NH <spcdados@cdl-nh.com.br>';
    const portalUrl = Deno.env.get('SPC_PORTAL_URL') || 'https://lucianomaurina-art.github.io/portal-demandas-cdl/calculadora-leads-prod/';

    const sb = createClient(supabaseUrl, serviceKey, {auth:{persistSession:false}});
    const {data:orders,error} = await sb
      .from('spc_data_order_sla')
      .select('id,proposal_code,client,stage,stage_due_at,overall_due_at,stage_sla_state,overall_sla_state,product,person,count_result,data_delivered_at,filters')
      .eq('active',true);
    if (error) throw error;

    const today = dateKey();
    const rawAlerts: Array<{order:any,type:string,severity:'warn'|'late'|'followup',label:string,deadline?:string|null}> = [];
    for (const o of orders || []) {
      const postSaleDue = o.filters?.post_sale === true ? addDays(o.data_delivered_at,60) : null;
      if (postSaleDue && postSaleDue.getTime() <= Date.now()) {
        rawAlerts.push({order:o,type:'post_sale_60_days',severity:'followup',label:'Realizar contato de pós-venda',deadline:postSaleDue.toISOString()});
      }
      if (o.stage === 'Dados enviados ao cliente' || o.stage === 'Cancelada') continue;
      if (o.stage_sla_state === 'atencao') rawAlerts.push({order:o,type:'stage_due_soon',severity:'warn',label:'Etapa vence em até 24h'});
      if (o.stage_sla_state === 'atrasado') rawAlerts.push({order:o,type:'stage_overdue',severity:'late',label:'Etapa atrasada'});
      if (o.overall_sla_state === 'atencao') rawAlerts.push({order:o,type:'overall_due_soon',severity:'warn',label:'Prazo total de 15 dias vence em até 24h'});
      if (o.overall_sla_state === 'atrasado') rawAlerts.push({order:o,type:'overall_overdue',severity:'late',label:'Prazo total de 15 dias vencido'});
    }

    if (!rawAlerts.length) return Response.json({ok:true,sent:false,message:'Nenhum alerta necessário.'});

    const {data:logs,error:logError} = await sb
      .from('spc_data_order_alert_log')
      .select('order_id,alert_type,alert_date,recipient')
      .eq('alert_date',today)
      .eq('recipient',recipientKey);
    if (logError) throw logError;
    const sent = new Set((logs||[]).map((x:any)=>`${x.order_id}|${x.alert_type}`));
    const {data:postSaleLogs,error:postSaleLogError} = await sb
      .from('spc_data_order_alert_log')
      .select('order_id,alert_type')
      .eq('alert_type','post_sale_60_days');
    if (postSaleLogError) throw postSaleLogError;
    const postSaleSent = new Set((postSaleLogs||[]).map((x:any)=>x.order_id));
    const alerts = rawAlerts.filter(a=>a.type==='post_sale_60_days'?!postSaleSent.has(a.order.id):!sent.has(`${a.order.id}|${a.type}`));
    if (!alerts.length) return Response.json({ok:true,sent:false,message:'Alertas de hoje já enviados.'});

    const lateCount = alerts.filter(a=>a.severity==='late').length;
    const rows = alerts.map(a=>{
      const o=a.order,c=o.client||{};
      const deadline=a.deadline||(a.type.startsWith('overall_')?o.overall_due_at:o.stage_due_at),color=a.severity==='late'?'#b42318':a.severity==='followup'?'#0b62d6':'#8a5a00';
      return `<tr><td style="padding:10px;border-bottom:1px solid #e5e7eb"><b>${esc(o.proposal_code||c.proposal_code||'—')}</b><br>${esc(c.company||'Cliente')}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb">${esc(a.type==='post_sale_60_days'?'Pós-venda':o.stage)}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;color:${color}"><b>${esc(a.label)}</b><br>Data programada: ${esc(fmt(deadline))}</td></tr>`;
    }).join('');

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#142033"><div style="max-width:760px;margin:auto"><h2 style="color:#071b33">Controle de prazos • SPC Dados</h2><p>Há ${alerts.length} alerta(s) que exigem acompanhamento no fluxo de Ordens SPC.</p><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f4f7fb"><th style="text-align:left;padding:10px">Proposta / cliente</th><th style="text-align:left;padding:10px">Etapa</th><th style="text-align:left;padding:10px">Situação</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:20px"><a href="${esc(portalUrl)}" style="background:#0b62d6;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px;display:inline-block">Abrir Portal SPC Dados</a></p><p style="font-size:12px;color:#667085">SLA operacional: até 15 dias corridos da proposta fechada até a entrega ao cliente.</p></div></body></html>`;

    const resend = await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':`Bearer ${resendKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({from,to:recipients,subject:alerts.some(a=>a.type==='post_sale_60_days')?'[SPC Dados] Contato de pós-venda programado':lateCount?`[SPC Dados] ${lateCount} prazo(s) em atraso`:'[SPC Dados] Prazos próximos do vencimento',html})
    });
    if (!resend.ok) throw new Error(`Resend ${resend.status}: ${await resend.text()}`);

    const entries = alerts.map(a=>({order_id:a.order.id,alert_type:a.type,alert_date:today,recipient:recipientKey}));
    const {error:insertError}=await sb.from('spc_data_order_alert_log').insert(entries);
    if (insertError) console.error('E-mail enviado, mas falhou o log de alertas:',insertError);

    return Response.json({ok:true,sent:true,alerts:alerts.length,late:lateCount});
  } catch (e) {
    console.error(e);
    return new Response(e instanceof Error?e.message:String(e),{status:500});
  }
});
