// Layout institucional da proposta comercial — CDL Novo Hamburgo + SPC Brasil
window.generateProposal=async function(){
  if(!quote){alert('Monte uma simulação antes de gerar a proposta.');return}
  const w=window.open('','_blank');
  if(!w){alert('O navegador bloqueou a abertura da proposta. Autorize pop-ups para este site e tente novamente.');return}
  w.document.write('<!doctype html><html><body style="font-family:Arial;padding:40px"><h3>Gerando proposta...</h3></body></html>');

  const {data:{user}}=await sb.auth.getUser();
  if(!user){w.close();alert('Sua sessão expirou. Entre novamente no portal para gerar a proposta.');return}
  const {data:profile}=await sb.from('profiles').select('name,email').eq('id',user.id).maybeSingle();
  const issuerName=(profile?.name||user.user_metadata?.name||user.email||'Usuário CDL').trim();
  const issuerEmail=profile?.email||user.email||'';

  // A observação da solicitação é tratada como texto original do cliente: não resumir, corrigir ou reescrever.
  let requestNotes='';
  if(currentRequestId){
    const {data:req}=await sb.from('lead_quote_requests').select('notes').eq('id',currentRequestId).maybeSingle();
    requestNotes=req?.notes||'';
  }

  const saved=await saveProposal('Proposta enviada',true);
  if(!saved){w.close();alert('Não foi possível salvar a proposta antes da geração.');return}

  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const c=clientData();
  const cdlLogo=new URL('../logo-cdl.svg',location.href).href;
  const spcLogo='https://mvl-aces.nyc3.digitaloceanspaces.com/upload/produtosservicos/g_foto399.jpg';

  const issuedAt=new Date();
  const validUntil=new Date(issuedAt); validUntil.setDate(validUntil.getDate()+7);
  const fmtDate=d=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
  const fmtTime=d=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);

  const rows=(quote.items||[]).map(i=>{
    const details=Array.isArray(i.details)?i.details:[];
    const detailHtml=details.length
      ? `<div class="included"><b>Inclui:</b><ul>${details.map(d=>`<li>${h(d)}</li>`).join('')}</ul></div>`
      : `<div class="included single">${mode==='individual'?'Dado selecionado para aquisição.':'Item adicional contratado.'}</div>`;
    return `<tr><td><b>${h(i.name)}</b>${detailHtml}</td><td class="price">${money(i.commercial_unit)} / lead</td></tr>`;
  }).join('');

  const notesHtml=requestNotes
    ? `<h2 class="section-title">Observações da solicitação</h2><div class="notes-box">${h(requestNotes)}</div>`
    : '';

  w.document.open();
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${h(saved.code)}</title><style>
  *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;padding:42px;color:#142033;max-width:920px;margin:auto;background:#fff}.brandbar{display:flex;align-items:center;justify-content:space-between;gap:30px;border-bottom:3px solid #0b62d6;padding-bottom:20px;margin-bottom:24px}.brands{display:flex;align-items:center;gap:28px;min-height:72px}.brand-cdl{width:155px;max-height:70px;object-fit:contain}.brand-spc{width:170px;max-height:72px;object-fit:contain}.proposal-id{text-align:right;color:#667085;font-size:13px}.proposal-id strong{display:block;color:#071b33;font-size:16px;margin-bottom:4px}h1{color:#071b33;font-size:30px;margin:0 0 8px}.subtitle{color:#667085;margin:0 0 20px}.issuebox{border:2px solid #0b62d6;border-radius:14px;padding:16px 18px;margin:0 0 22px;background:#f4f8ff}.issue-title{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#0b62d6;margin-bottom:10px}.issuegrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 24px;font-size:13px}.issuegrid b{color:#071b33}.client-box{background:#f4f7fb;border:1px solid #dce3ed;border-radius:14px;padding:18px 20px;margin-bottom:24px}.client-box h3{margin:0 0 8px;color:#071b33}.meta{line-height:1.65;color:#344054}.section-title{font-size:18px;color:#071b33;margin:28px 0 10px}.notes-box{background:#fffaf0;border:1px solid #efd39a;border-left:4px solid #d59a27;border-radius:12px;padding:16px 18px;line-height:1.6;color:#344054;white-space:pre-wrap}table{width:100%;border-collapse:collapse;border:1px solid #dce3ed}th{background:#f4f7fb;color:#344054;font-size:13px}td,th{padding:12px 14px;border-bottom:1px solid #e7ecf2;text-align:left;vertical-align:top}.price{width:190px;white-space:nowrap;font-weight:700}.included{margin-top:8px;color:#475467;font-size:12px;line-height:1.5}.included ul{margin:5px 0 0;padding-left:18px;columns:2}.included.single{font-style:italic;color:#667085}.total-box{margin-top:24px;background:#071b33;color:#fff;border-radius:16px;padding:22px}.total-label{font-size:13px;opacity:.8;text-transform:uppercase}.total{font-size:32px;font-weight:800;margin-top:5px}.validity{margin-top:12px;font-size:13px}.cta{margin-top:26px;padding:18px 20px;background:#eef6ff;border-left:4px solid #0b62d6;border-radius:10px;line-height:1.55}.footer{margin-top:34px;padding-top:18px;border-top:1px solid #dce3ed;color:#667085;font-size:12px;display:flex;justify-content:space-between}.print{margin-top:24px;padding:11px 16px;border:0;border-radius:10px;background:#0b62d6;color:#fff;font-weight:700;cursor:pointer}@media print{body{padding:20px}.print{display:none}.issuebox,.total-box,.notes-box{break-inside:avoid}.total-box{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body>
  <div class="brandbar"><div class="brands"><img class="brand-cdl" src="${cdlLogo}" alt="CDL Novo Hamburgo"><img class="brand-spc" src="${spcLogo}" alt="SPC Brasil"></div><div class="proposal-id"><strong>Proposta Comercial</strong>${h(saved.code)}</div></div>
  <h1>SPC Dados</h1><p class="subtitle">Solução de dados preparada pela CDL Novo Hamburgo em parceria com o SPC Brasil.</p>
  <div class="issuebox"><div class="issue-title">Informações da proposta</div><div class="issuegrid">
    <div><b>Data de emissão:</b> ${h(fmtDate(issuedAt))}</div>
    <div><b>Horário de emissão:</b> ${h(fmtTime(issuedAt))}</div>
    <div><b>Validade:</b> 7 dias</div>
    <div><b>Válida até:</b> ${h(fmtDate(validUntil))}</div>
    <div><b>Emissor:</b> ${h(issuerName)}</div>
    <div><b>Login:</b> ${h(issuerEmail)}</div>
  </div></div>
  <div class="client-box"><h3>${h(c.company||'Cliente')}</h3><div class="meta">${c.doc?`<b>CNPJ/CPF:</b> ${h(c.doc)}<br>`:''}${c.contact?`<b>Contato:</b> ${h(c.contact)}<br>`:''}${c.email?`<b>E-mail:</b> ${h(c.email)}<br>`:''}${c.phone?`<b>Telefone:</b> ${h(c.phone)}<br>`:''}${c.focus?`<b>Região/foco:</b> ${h(c.focus)}`:''}</div></div>
  <div class="meta"><b>Solução:</b> ${mode==='individual'?'Dados individuais':'Combo de dados'} • ${h(quote.person)}<br><b>Quantidade:</b> ${num(quote.quantity)} leads</div>
  ${notesHtml}
  <h2 class="section-title">Composição detalhada da solução</h2><table><thead><tr><th>O que está incluído</th><th>Investimento por lead</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="total-box"><div class="total-label">Investimento total</div><div class="total">${money(quote.sale_total)}</div><div class="validity"><b>Validade desta proposta:</b> 7 dias, até ${h(fmtDate(validUntil))}.</div></div>
  <div class="cta"><b>Próximo passo</b><br>Valide o escopo com seu consultor CDL para confirmar disponibilidade da base, condições da contratação e início do atendimento.</div>
  <div class="footer"><span>CDL Novo Hamburgo</span><span>SPC Brasil • Inteligência de dados para negócios</span></div><button class="print" onclick="print()">Imprimir / salvar em PDF</button>
  </body></html>`);w.document.close();

  if(currentRequestId)await sb.from('lead_quote_requests').update({status:'Proposta enviada',updated_at:new Date().toISOString()}).eq('id',currentRequestId);
  if(typeof showHistory==='function')showHistory(true);
};
