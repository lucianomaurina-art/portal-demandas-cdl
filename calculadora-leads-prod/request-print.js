// Ficha interna imprimível da solicitação de cotação — CDL Novo Hamburgo + SPC Brasil
(() => {
  const escPrint=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labelFlag=name=>{
    const n=String(name||'').trim();
    if(n==='Restrição 1 bureau')return 'Birô de crédito 1 (SPC)';
    if(n==='Restrição 2 bureaux')return 'Birô de crédito 2 (SPC e Serasa)';
    if(n==='PEP')return 'PEP (Pessoa Exposta Politicamente)';
    return n;
  };
  const fmtDateTime=value=>value?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
  const fmtNow=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
  const textBlock=(title,text,cls='box')=>`<section class="${cls}"><h3>${escPrint(title)}</h3><div class="pre">${text?escPrint(text):'<span class="empty">Não informado.</span>'}</div></section>`;
  function selectionHtml(r){
    if(r.mode==='individual'){
      const arr=Array.isArray(r.selection)?r.selection:[];
      if(!arr.length)return '<div class="empty">Nenhum dado registrado.</div>';
      return `<ul>${arr.map(x=>`<li><b>${escPrint(labelFlag(x.flag||'Informação'))}</b>${x.product?` <span>• ${escPrint(x.product)}</span>`:''}</li>`).join('')}</ul>`;
    }
    const level=r.selection?.level||'—',addons=Array.isArray(r.selection?.addons)?r.selection.addons:[];
    return `<div><b>Combo:</b> ${escPrint(level)}</div>${addons.length?`<div class="sub"><b>Adicionais:</b></div><ul>${addons.map(a=>`<li>${escPrint(labelFlag(a))}</li>`).join('')}</ul>`:''}`;
  }

  window.printQuoteRequest=async function(id){
    const w=window.open('','_blank');
    if(!w){alert('O navegador bloqueou a abertura da impressão. Autorize pop-ups para este site e tente novamente.');return}
    w.document.write('<!doctype html><html><body style="font-family:Arial;padding:40px"><h3>Preparando solicitação...</h3></body></html>');
    try{
      const {data:r,error}=await sb.from('lead_quote_requests').select('*').eq('id',id).single();
      if(error||!r)throw error||new Error('Solicitação não encontrada');
      const {data:{user}}=await sb.auth.getUser();
      let profile=null;
      if(user){const resp=await sb.from('profiles').select('name,email').eq('id',user.id).maybeSingle();profile=resp.data||null;}
      const issuerName=(profile?.name||user?.user_metadata?.name||user?.email||'Usuário CDL').trim();
      const issuerEmail=profile?.email||user?.email||'';
      const c=r.client||{};
      const cnaeSegments=c.cnae_segments||c.cnaes_segments||c.target_segments||'';
      const cdlLogo=new URL('../logo-cdl.svg',location.href).href;
      const spcLogo='https://mvl-aces.nyc3.digitaloceanspaces.com/upload/produtosservicos/g_foto399.jpg';
      const objective=c.objective||'';
      const need=c.need||'';
      w.document.open();
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escPrint(r.code)} • Solicitação interna</title><style>
        @page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#142033;margin:0;background:#fff;font-size:12px;line-height:1.5}.brandbar{display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:3px solid #0b62d6;padding-bottom:16px;margin-bottom:20px}.brands{display:flex;align-items:center;gap:24px}.cdl{width:145px;max-height:65px;object-fit:contain}.spc{width:155px;max-height:65px;object-fit:contain}.docid{text-align:right;color:#667085}.docid b{display:block;color:#071b33;font-size:17px}.internal{display:inline-block;margin-top:6px;background:#fff1d6;color:#8a5a00;font-weight:800;font-size:10px;padding:4px 7px;border-radius:999px}.title{margin:0;color:#071b33;font-size:25px}.subtitle{color:#667085;margin:4px 0 18px}.info{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 22px;background:#f4f8ff;border:1px solid #bfd4ee;border-radius:12px;padding:14px 16px;margin-bottom:18px}.info b{color:#071b33}.section-title{font-size:16px;color:#071b33;margin:22px 0 9px}.client{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 20px;border:1px solid #dce3ed;border-radius:12px;padding:15px;background:#fafbfc}.client .full{grid-column:1/-1}.box{border:1px solid #dce3ed;border-radius:12px;padding:14px 16px;margin-top:12px;background:#fff}.box h3,.internalbox h3{font-size:13px;color:#071b33;margin:0 0 7px}.internalbox{border:1px solid #efd39a;border-left:4px solid #d59a27;border-radius:12px;padding:14px 16px;margin-top:12px;background:#fffaf0}.pre{white-space:pre-wrap}.empty{color:#98a2b3;font-style:italic}.selection{border:1px solid #dce3ed;border-radius:12px;padding:14px 16px}.selection ul{margin:7px 0 0;padding-left:20px}.selection li{margin:3px 0}.selection span{color:#667085}.sub{margin-top:8px}.footer{margin-top:26px;padding-top:12px;border-top:1px solid #dce3ed;display:flex;justify-content:space-between;color:#667085;font-size:10.5px}.printbtn{display:block;margin:22px auto 0;border:0;background:#0b62d6;color:#fff;padding:10px 16px;border-radius:9px;font-weight:800;cursor:pointer}@media print{.printbtn{display:none}.brandbar,.info,.client,.box,.internalbox,.selection{break-inside:avoid}}
      </style></head><body>
        <div class="brandbar"><div class="brands"><img class="cdl" src="${cdlLogo}" alt="CDL Novo Hamburgo"><img class="spc" src="${spcLogo}" alt="SPC Brasil"></div><div class="docid"><b>Solicitação de Cotação</b>${escPrint(r.code)}<br><span class="internal">USO INTERNO • VALIDAÇÃO SPC BRASIL</span></div></div>
        <h1 class="title">SPC Dados</h1><p class="subtitle">Ficha consolidada para análise, refinamento e apoio à cotação.</p>
        <div class="info"><div><b>Data da solicitação:</b> ${escPrint(fmtDateTime(r.created_at))}</div><div><b>Data/hora da impressão:</b> ${escPrint(fmtNow())}</div><div><b>Emitido por:</b> ${escPrint(issuerName)}</div><div><b>Login:</b> ${escPrint(issuerEmail||'—')}</div><div><b>Etapa atual:</b> ${escPrint(r.status||'—')}</div><div><b>Quantidade solicitada:</b> ${Number(r.quantity||0).toLocaleString('pt-BR')} leads</div></div>
        <h2 class="section-title">Dados da empresa e do solicitante</h2><div class="client"><div><b>Empresa</b><br>${escPrint(c.company||'—')}</div><div><b>CNPJ/CPF</b><br>${escPrint(c.doc||'—')}</div><div><b>Solicitante / contato</b><br>${escPrint(c.contact||'—')}</div><div><b>E-mail</b><br>${escPrint(c.email||'—')}</div><div><b>Telefone</b><br>${escPrint(c.phone||'—')}</div><div><b>Tipo de pessoa buscada</b><br>${escPrint(r.person||'—')}</div><div class="full"><b>Região / foco</b><br>${escPrint(c.focus||'—')}</div>${need?`<div class="full"><b>Necessidade informada</b><br>${escPrint(need)}</div>`:''}${objective?`<div class="full"><b>Objetivo da ação</b><br>${escPrint(objective)}</div>`:''}</div>
        ${c.existing_data?textBlock('Dados que o cliente já possui na base',c.existing_data):''}
        ${cnaeSegments?textBlock('CNAEs ou segmentos desejados',cnaeSegments):''}
        <h2 class="section-title">Dados solicitados para a cotação</h2><div class="selection">${selectionHtml(r)}</div>
        ${textBlock('Observações do cliente',r.notes||'')}
        ${textBlock('Informações adicionais / observações internas',c.internal_notes||'','internalbox')}
        <div class="footer"><span>CDL Novo Hamburgo • SPC Dados</span><span>${escPrint(r.code)} • Documento de uso interno</span></div>
        <button class="printbtn" onclick="window.print()">Imprimir / salvar em PDF</button>
      </body></html>`);
      w.document.close();
    }catch(err){console.error(err);w.close();alert('Não foi possível preparar a impressão desta solicitação.');}
  };

  // Injeta o botão na ficha de solicitação sempre que o modal for aberto/renderizado.
  const obs=new MutationObserver(()=>{
    const d=document.getElementById('requestDetailDialog');
    if(!d||!d.open||d.querySelector('[data-print-request]'))return;
    const actions=d.querySelector('.card-actions');
    if(!actions)return;
    const primary=actions.querySelector('.primary');
    const m=primary?.getAttribute('onclick')?.match(/loadRequestFromKanban\('([^']+)'\)/);
    if(!m)return;
    const btn=document.createElement('button');btn.className='ghost';btn.dataset.printRequest='1';btn.textContent='Imprimir solicitação';btn.onclick=()=>window.printQuoteRequest(m[1]);actions.insertBefore(btn,primary||null);
  });
  obs.observe(document.body,{childList:true,subtree:true});
})();