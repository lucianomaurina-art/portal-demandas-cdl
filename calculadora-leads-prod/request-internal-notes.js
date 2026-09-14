// Informações adicionais da solicitação — internas e destinadas à proposta.
// Mantém a observação original do cliente intacta e salva complementos no JSON client.
(() => {
  const escReq=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const flagLabelReq=name=>{
    const n=String(name||'').trim();
    if(n==='Restrição 1 bureau')return 'Birô de crédito 1 (SPC)';
    if(n==='Restrição 2 bureaux')return 'Birô de crédito 2 (SPC e Serasa)';
    if(n==='PEP')return 'PEP (Pessoa Exposta Politicamente)';
    return n;
  };

  function ensureRequestDialogLocal(){
    let d=document.getElementById('requestDetailDialog');
    if(d)return d;
    d=document.createElement('dialog');
    d.id='requestDetailDialog';
    d.style.cssText='width:min(820px,calc(100% - 30px));border:0;border-radius:18px;padding:0;box-shadow:0 25px 80px rgba(0,0,0,.28)';
    document.body.appendChild(d);
    return d;
  }

  function describeSelectionLocal(r){
    if(r.mode==='individual'){
      const arr=Array.isArray(r.selection)?r.selection:[];
      return arr.length?arr.map(x=>`<li><b>${escReq(flagLabelReq(x.flag||'Informação'))}</b><span class="muted">${x.product?` • ${escReq(x.product)}`:''}</span></li>`).join(''):'<li>Nenhuma informação registrada.</li>';
    }
    const level=r.selection?.level||'—',addons=Array.isArray(r.selection?.addons)?r.selection.addons:[];
    return `<li><b>Combo:</b> ${escReq(level)}</li>${addons.map(a=>`<li><b>Adicional:</b> ${escReq(flagLabelReq(a))}</li>`).join('')}`;
  }

  async function saveRequestNoteField(id,field,inputId,buttonId,messageId,successText){
    const input=document.getElementById(inputId),btn=document.getElementById(buttonId),msg=document.getElementById(messageId);
    if(!input)return;
    if(btn){btn.disabled=true;btn.textContent='Salvando…';}
    if(msg)msg.textContent='';
    try{
      const {data:r,error:readError}=await sb.from('lead_quote_requests').select('client').eq('id',id).single();
      if(readError)throw readError;
      const client={...(r?.client||{}),[field]:input.value.trim()};
      const {error}=await sb.from('lead_quote_requests').update({client,updated_at:new Date().toISOString()}).eq('id',id);
      if(error)throw error;
      if(msg){msg.textContent=successText;msg.style.color='#176b4d';}
      if(btn)btn.textContent='Salvo';
      setTimeout(()=>{if(btn){btn.disabled=false;btn.textContent='Salvar';}},900);
    }catch(error){
      console.error(error);
      if(msg){msg.textContent='Não foi possível salvar esta informação.';msg.style.color='#b42318';}
      if(btn){btn.disabled=false;btn.textContent='Salvar';}
    }
  }

  window.saveRequestInternalNotes=id=>saveRequestNoteField(id,'internal_notes','requestInternalNotesInput','saveRequestInternalNotesBtn','requestInternalNotesMsg','Informações internas salvas.');
  window.saveRequestProposalNotes=id=>saveRequestNoteField(id,'proposal_notes','requestProposalNotesInput','saveRequestProposalNotesBtn','requestProposalNotesMsg','Informações para a proposta salvas.');

  window.viewRequest=async function(id){
    const {data:r,error}=await sb.from('lead_quote_requests').select('*').eq('id',id).single();
    if(error||!r){alert('Não foi possível abrir esta solicitação.');return}
    const c=r.client||{},d=ensureRequestDialogLocal();
    const clientNotes=r.notes||'';
    const internalNotes=c.internal_notes||'';
    const proposalNotes=c.proposal_notes||'';
    const cnaeSegments=c.cnae_segments||c.cnaes_segments||c.target_segments||'';
    d.innerHTML=`<div style="padding:24px">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start"><div><div class="eyebrow">${escReq(r.code)}</div><h2 style="margin:6px 0">${escReq(c.company||'Solicitação de cotação')}</h2><div class="muted">Recebida em ${new Date(r.created_at).toLocaleString('pt-BR')}</div></div><button class="ghost" onclick="document.getElementById('requestDetailDialog').close()">Fechar</button></div>
      <hr style="border:0;border-top:1px solid #dce3ed;margin:20px 0">
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 22px"><div><b>Contato</b><br>${escReq(c.contact||'—')}</div><div><b>E-mail</b><br>${escReq(c.email||'—')}</div><div><b>Telefone</b><br>${escReq(c.phone||'—')}</div><div><b>CNPJ/CPF</b><br>${escReq(c.doc||'—')}</div><div><b>Tipo de pessoa</b><br>${escReq(r.person)}</div><div><b>Quantidade</b><br>${num(r.quantity)} leads</div></div>
      ${c.existing_data?`<div style="margin-top:20px;padding:14px;background:#f4f7fb;border-radius:12px"><b>Dados que o cliente já possui</b><div style="margin-top:6px;white-space:pre-wrap">${escReq(c.existing_data)}</div></div>`:''}
      ${cnaeSegments?`<div style="margin-top:20px;padding:14px;background:#eef6ff;border-radius:12px"><b>CNAEs ou segmentos desejados</b><div style="margin-top:6px;white-space:pre-wrap">${escReq(cnaeSegments)}</div></div>`:''}
      <div style="margin-top:20px"><b>Dados solicitados para cotação</b><ul style="line-height:1.7;margin-top:8px">${describeSelectionLocal(r)}</ul></div>
      <div style="margin-top:20px"><b>Observações do cliente</b><div style="margin-top:6px;padding:12px 14px;background:#f8fafc;border:1px solid #e4e7ec;border-radius:10px;white-space:pre-wrap;color:${clientNotes?'#344054':'#98a2b3'}">${clientNotes?escReq(clientNotes):'Nenhuma observação informada pelo cliente.'}</div></div>

      <div style="margin-top:20px;padding:16px;background:#fff8e8;border:1px solid #efd39a;border-radius:12px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><b>Informações adicionais internas</b><div class="muted" style="font-size:12px;margin-top:4px">Registre aqui informações de apoio à análise, tratativas com SPC Brasil e demais dados que não devem aparecer na proposta do cliente.</div></div><span style="font-size:10px;font-weight:900;color:#8a5a00;background:#fff1d6;padding:5px 8px;border-radius:999px">USO INTERNO</span></div><textarea id="requestInternalNotesInput" rows="5" style="width:100%;margin-top:12px;border:1px solid #dce3ed;border-radius:10px;padding:12px;resize:vertical" placeholder="Ex.: após contato com o cliente, confirmou que deseja empresas do setor industrial...">${escReq(internalNotes)}</textarea><div id="requestInternalNotesMsg" class="muted" style="font-size:12px;margin-top:7px"></div><div style="display:flex;justify-content:flex-end;margin-top:10px"><button id="saveRequestInternalNotesBtn" class="secondary" onclick="saveRequestInternalNotes('${r.id}')">Salvar</button></div></div>

      <div style="margin-top:16px;padding:16px;background:#eef6ff;border:1px solid #bfd4ee;border-radius:12px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><b>Informações adicionais para a proposta</b><div class="muted" style="font-size:12px;margin-top:4px">Tudo o que for registrado aqui será levado para a proposta comercial gerada a partir desta solicitação.</div></div><span style="font-size:10px;font-weight:900;color:#084fae;background:#dbeafe;padding:5px 8px;border-radius:999px">VAI PARA A PROPOSTA</span></div><textarea id="requestProposalNotesInput" rows="5" style="width:100%;margin-top:12px;border:1px solid #9fc5f6;border-radius:10px;padding:12px;resize:vertical" placeholder="Ex.: escopo validado com o cliente; considerar empresas do segmento X, com os seguintes critérios...">${escReq(proposalNotes)}</textarea><div id="requestProposalNotesMsg" class="muted" style="font-size:12px;margin-top:7px"></div><div style="display:flex;justify-content:flex-end;margin-top:10px"><button id="saveRequestProposalNotesBtn" class="secondary" onclick="saveRequestProposalNotes('${r.id}')">Salvar</button></div></div>

      <div class="card-actions" style="justify-content:flex-end;margin-top:24px"><button class="primary" onclick="document.getElementById('requestDetailDialog').close();loadRequestFromKanban('${r.id}')">Orçar agora</button></div>
    </div>`;
    d.showModal();
  };
})();