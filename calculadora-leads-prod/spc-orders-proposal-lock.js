// Revisão controlada da proposta durante a validação da contagem SPC.
(()=>{
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  const canon=s=>norm(s)
    .replace(/\b1\b$/,'').trim()
    .replace(/^NOME$/,'NOME COMPLETO')
    .replace(/^ENDERECO$/,'ENDERECO COMPLETO')
    .replace(/^DATA DE ABERTURA$/,'DATA DE FUNDACAO')
    .replace(/^RESTRICAO SPC$/,'RESTRICAO 1 BUREAU')
    .replace(/^RESTRICAO SPC E SERASA$/,'RESTRICAO 2 BUREAUX')
    .replace(/^QUADRO SOCIAL ADMINISTRATIVO$/,'QUADRO SOCIAL E ADMINISTRATIVO')
    .replace(/^TELEFONE CELULAR$/,'TELEFONE MOVEL')
    .replace(/^QUANTIDADE DE FUNCIONARIOS$/,'NUMERO DE FUNCIONARIOS')
    .replace(/^COD E DESCRICAO DA ATIVIDADE ECONOMICA$/,'CNAE');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const moneyValue=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const same=(a,b)=>canon(a)===canon(b);
  const uniq=a=>{const out=[];(a||[]).filter(Boolean).forEach(x=>{if(!out.some(y=>same(y,x)))out.push(x)});return out};

  function proposalEntries(p){
    const out=[],add=(name,source)=>{if(name&&!out.some(x=>same(x.name,name)))out.push({name,source})};
    if(p?.mode==='combo'){
      const level=p.selection?.level||'';
      const combo=(window.LEAD_CATALOG?.combos||[]).find(c=>c.person===p.person&&norm(c.level)===norm(level));
      (combo?.items||[]).forEach(x=>add(x,`Combo ${level}`));
      (p.selection?.addons||[]).forEach(x=>add(x,'Adicional contratado'));
    }else{
      (p?.quote?.items||[]).forEach(i=>{
        if(Array.isArray(i.details)&&i.details.length)i.details.forEach(x=>add(x,'Contratado na proposta'));
        else if(i.name&&!/^outro produto/i.test(i.name))add(String(i.name).replace(/^.*?\s—\s/,''),'Contratado na proposta');
      });
      if(Array.isArray(p?.selection))p.selection.forEach(x=>add(x.flag||x.name||x,'Contratado na proposta'));
    }
    return out;
  }

  function lockDialog(entries,message){
    const heading=[...document.querySelectorAll('#spcOrderDialog h3')].find(x=>x.textContent.includes('Atributos que o SPC deve retornar'));
    if(!heading)return;
    const note=heading.nextElementSibling,list=note?.nextElementSibling;
    if(note?.classList.contains('muted'))note.textContent=message||'Atributos definidos na proposta e preservados nesta etapa operacional.';
    if(list?.classList.contains('items')){
      list.innerHTML=entries.length?entries.map(x=>`<div style="border:1px solid #bfd4ee;background:#f4f8ff;border-radius:11px;padding:11px 13px;display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b style="font-size:13px">✓ ${esc(x.name)}</b></div><span class="muted" style="font-size:11px;white-space:nowrap">${esc(x.source)}</span></div>`).join(''):'<div class="muted">Nenhum atributo contratado encontrado na proposta.</div>';
      entries.forEach(x=>list.insertAdjacentHTML('beforeend',`<input type="checkbox" name="spcField" value="${esc(x.name)}" checked style="display:none" aria-hidden="true" tabindex="-1">`));
    }
  }

  function enableValidationReview(id,p,o,entries){
    const heading=[...document.querySelectorAll('#spcOrderDialog h3')].find(x=>x.textContent.includes('Atributos que o SPC deve retornar'));
    if(!heading)return;
    const note=heading.nextElementSibling,list=note?.nextElementSibling;
    if(note?.classList.contains('muted'))note.textContent='Desmarque somente as variáveis dispensadas pelo cliente. O valor será recalculado antes de salvar.';
    if(list?.classList.contains('items')){
      list.innerHTML=entries.map(x=>`<label class="item" style="margin:0"><input type="checkbox" name="spcField" value="${esc(x.name)}" checked onchange="previewSpcProposalRevision('${id}')"><span><b>${esc(x.name)}</b><small class="muted" style="display:block">${esc(x.source)}</small></span></label>`).join('');
    }
    const box=document.createElement('div');box.id='soProposalRevisionBox';box.className='notice';box.style.cssText='margin:14px 0;border-left-color:#7a4b00;background:#fff8e8';
    box.innerHTML=`<b>Revisão da proposta na validação</b><div class="muted" style="margin-top:5px">Valor atual: <b>${moneyValue(p.quote?.sale_total)}</b>. A contagem original permanecerá registrada no histórico.</div><div id="soProposalRevisionPreview" style="margin-top:8px;font-weight:800">Nenhuma variável removida.</div><label style="margin-top:12px">Motivo / observação da alteração</label><textarea id="soProposalRevisionNote" rows="2">Variáveis dispensadas pelo cliente na validação da contagem.</textarea><input type="hidden" id="soProposalReviewStage" value="${esc(o.stage||'')}"><input type="hidden" id="soProposalReviewOriginal" value="${esc(JSON.stringify(entries.map(x=>x.name)))}">`;
    heading.parentNode.insertBefore(box,heading);
    const actions=document.querySelector('#spcOrderDialog .actions');
    if(actions&&!actions.querySelector('[data-generate-updated-proposal]'))actions.insertAdjacentHTML('beforeend',`<button type="button" class="primary" data-generate-updated-proposal onclick="generateUpdatedSpcProposal('${id}')">Salvar e gerar proposta atualizada</button>`);
  }

  function removedFields(){
    const original=JSON.parse(document.getElementById('soProposalReviewOriginal')?.value||'[]');
    const kept=[...document.querySelectorAll('input[name="spcField"]:checked')].map(x=>x.value);
    return {original,kept,removed:original.filter(x=>!kept.some(y=>same(x,y)))};
  }

  function criteriaAffected(removed,o){
    const f=o?.filters||{},t=o?.targeting||{};
    const rules=[
      [['SEXO'],()=>Boolean(f.sex)],
      [['DATA DE NASCIMENTO'],()=>Boolean(f.age)],
      [['PROFISSAO'],()=>Boolean(f.cbo)],
      [['RENDA PRESUMIDA'],()=>Boolean(f.income)],
      [['DATA DE FUNDACAO'],()=>Boolean(f.opening_date)],
      [['CNAE'],()=>Boolean(f.cnae_text||f.legacy_cnae||t.free_text||(t.cnaes||[]).length||(t.roots||[]).length)],
      [['FATURAMENTO PRESUMIDO'],()=>Boolean(f.revenue)],
      [['PORTE','NUMERO DE FUNCIONARIOS'],()=>Boolean(f.revenue)]
    ];
    return removed.filter(field=>rules.some(([names,active])=>names.includes(canon(field))&&active()));
  }

  function renderRevisionHistory(o){
    const history=Array.isArray(o?.filters?.proposal_revision_history)?o.filters.proposal_revision_history:[];
    if(!history.length)return;
    const actions=document.querySelector('#spcOrderDialog .actions');if(!actions)return;
    const box=document.createElement('div');box.style.cssText='margin:22px 0;padding:16px;border:1px solid #d7e0ea;border-radius:14px;background:#f9fbfe';
    box.innerHTML=`<h3 style="margin-top:0">Histórico de revisões da proposta</h3>${history.slice().reverse().map((item,index)=>`<div style="padding:12px 0;${index?'border-top:1px solid #e2e8f0':''}"><b>${new Date(item.changed_at).toLocaleString('pt-BR')} • ${item.requires_recount?'Encaminhada para recontagem':'Contagem mantida'}</b><div class="muted" style="margin-top:4px">Removidas: ${esc((item.removed_fields||[]).join(', ')||'—')}<br>Valor anterior: ${moneyValue(item.original_proposal?.quote?.sale_total)}<br>Contagem preservada: ${esc(item.original_count?.reference||'sem referência')} • ${item.original_count?.result==null?'quantidade não informada':Number(item.original_count.result).toLocaleString('pt-BR')+' registros'}${item.note?`<br>Observação: ${esc(item.note)}`:''}</div></div>`).join('')}`;
    actions.parentNode.insertBefore(box,actions);
  }

  window.previewSpcProposalRevision=async id=>{
    const preview=document.getElementById('soProposalRevisionPreview');if(!preview)return;
    const {kept,removed}=removedFields();
    const [{data:o},{data:p}]=await Promise.all([
      sb.from('spc_data_orders').select('*').eq('id',id).maybeSingle(),
      sb.from('spc_data_orders').select('proposal_id').eq('id',id).maybeSingle().then(r=>r.data?.proposal_id?sb.from('lead_proposals').select('*').eq('id',r.data.proposal_id).maybeSingle():({data:null}))
    ]);
    if(!removed.length){preview.innerHTML=`Nenhuma variável removida. Valor da proposta: <b>${moneyValue(p?.quote?.sale_total)}</b>.`;return}
    if(!kept.length){preview.innerHTML='<span style="color:#b42318">Mantenha pelo menos uma variável na proposta.</span>';return}
    preview.innerHTML='Recalculando valor…';
    try{
      const commercial=await revisedCommercialData(p,o,kept),affected=criteriaAffected(removed,o);
      if(!document.getElementById('soProposalRevisionPreview'))return;
      preview.innerHTML=`Novo valor da proposta: <span style="font-size:20px;color:#0b62d6">${moneyValue(commercial.quote.sale_total)}</span><br><span style="font-weight:400">Removidas: ${esc(removed.join(', '))}.</span><br>${affected.length?`⚠ Exige recontagem porque interfere nos filtros: ${esc(affected.join(', '))}.`:'✓ Altera somente os dados entregues; a contagem atual pode ser validada.'}`;
    }catch(error){console.error(error);preview.innerHTML=`<span style="color:#b42318">${esc(error.message||'Não foi possível recalcular o valor.')}</span>`}
  };

  function proposalDocument(p,o,w){
    const q=p.quote||{},c={...(p.client||{}),...(o.client||{})},items=q.items||[],issued=new Date(),valid=new Date(issued);valid.setDate(valid.getDate()+7);
    const fmt=d=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d),unit=Number(q.quantity||p.quantity||0)>0?Number(q.sale_total||0)/Number(q.quantity||p.quantity):Number(q.sale_unit||0),cdlLogo=new URL('../logo-cdl.svg',location.href).href,spcLogo=new URL('../logo-spc-brasil.png',location.href).href;
    const rows=items.map(item=>`<tr><td><b>${esc(item.name||'Item')}</b>${Array.isArray(item.details)&&item.details.length?`<ul>${item.details.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</td><td>${moneyValue(item.commercial_unit)} / lead</td></tr>`).join('');
    const revisions=Array.isArray(o.filters?.proposal_revision_history)?o.filters.proposal_revision_history:[],last=revisions[revisions.length-1],removed=last?.removed_fields||[];
    w.document.open();w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.code)} — Proposta atualizada</title><style>*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;padding:42px;color:#142033;max-width:920px;margin:auto}.brandbar{display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:3px solid #0b62d6;padding-bottom:18px}.brands{display:flex;align-items:center;gap:24px}.brands img{max-width:155px;max-height:65px}.code{text-align:right;color:#667085}.code b{display:block;color:#071b33;font-size:17px}.tag{display:inline-block;margin-top:20px;padding:7px 10px;border-radius:999px;background:#e8f1ff;color:#084fae;font-size:11px;font-weight:900;text-transform:uppercase}.client{margin:22px 0;padding:18px;background:#f4f7fb;border:1px solid #dce3ed;border-radius:14px;line-height:1.6}.revision{margin:18px 0;padding:15px 17px;background:#fff8e8;border-left:4px solid #d99a00;border-radius:10px;line-height:1.55}table{width:100%;border-collapse:collapse;border:1px solid #dce3ed;margin-top:12px}th{background:#f4f7fb}th,td{padding:12px 14px;border-bottom:1px solid #e7ecf2;text-align:left;vertical-align:top}td:last-child{width:190px;white-space:nowrap;font-weight:700}ul{margin:7px 0 0;padding-left:19px;columns:2}.total{margin-top:24px;padding:22px;background:#071b33;color:#fff;border-radius:16px}.total strong{display:block;font-size:32px;margin:5px 0}.terms{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}.term{padding:14px;border:1px solid #dce3ed;border-radius:12px;background:#f8fbff;font-size:13px;line-height:1.45}.term b{display:block;margin-bottom:5px}.footer{margin-top:30px;padding-top:16px;border-top:1px solid #dce3ed;color:#667085;font-size:12px;display:flex;justify-content:space-between}.print{margin-top:22px;padding:11px 16px;border:0;border-radius:10px;background:#0b62d6;color:#fff;font-weight:700}@media(max-width:700px){.terms{grid-template-columns:1fr}}@media print{body{padding:20px}.print{display:none}.total,.revision,.terms{break-inside:avoid}}</style></head><body><div class="brandbar"><div class="brands"><img src="${cdlLogo}" alt="CDL Novo Hamburgo"><img src="${spcLogo}" alt="SPC Brasil"></div><div class="code"><b>Proposta Comercial Atualizada</b>${esc(p.code)}</div></div><div class="tag">Atualizada após validação da contagem</div><h1>SPC Dados</h1><p>Emitida em ${fmt(issued)} • válida até ${fmt(valid)}</p><div class="client"><b>${esc(c.company||'Cliente')}</b><br>${c.doc?`CNPJ/CPF: ${esc(c.doc)}<br>`:''}${c.contact?`Contato: ${esc(c.contact)}<br>`:''}${c.email?`E-mail: ${esc(c.email)}<br>`:''}${c.phone?`Telefone: ${esc(c.phone)}<br>`:''}<b>Quantidade:</b> ${Number(q.quantity||p.quantity||0).toLocaleString('pt-BR')} leads</div>${last?`<div class="revision"><b>Ajuste realizado na validação</b><br>${removed.length?`Variáveis retiradas: ${esc(removed.join(', '))}.<br>`:''}${last.note?`${esc(last.note)}<br>`:''}${last.requires_recount?'A alteração exige nova contagem do SPC.':'A contagem recebida permanece válida.'}</div>`:''}<h2>Composição atualizada</h2><table><thead><tr><th>O que está incluído</th><th>Investimento por lead</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><span>Investimento total atualizado</span><strong>${moneyValue(q.sale_total)}</strong><div>Valor total por lead: ${moneyValue(unit)} / lead</div></div><div class="terms"><div class="term"><b>Prazo médio</b>Até 15 dias após a confirmação do pedido, conforme o fluxo operacional.</div><div class="term"><b>Pagamento</b>10% para confirmação e saldo de 90% na próxima fatura.</div><div class="term"><b>Entrega</b>Base disponibilizada em planilha Google ou Microsoft Excel.</div></div><div class="footer"><span>CDL Novo Hamburgo</span><span>SPC Brasil • Inteligência de dados para negócios</span></div><button class="print" onclick="print()">Imprimir / salvar em PDF</button></body></html>`);w.document.close();
  }

  window.generateUpdatedSpcProposal=async id=>{
    const w=window.open('','_blank');if(!w)return alert('Autorize pop-ups para gerar a proposta atualizada.');
    w.document.write('<!doctype html><html><body style="font-family:Arial;padding:40px"><h3>Atualizando e gerando a proposta…</h3></body></html>');
    const ok=await window.saveSpcOrder(id,true);if(ok===false){w.close();return}
    const {data:o,error}=await sb.from('spc_data_orders').select('*').eq('id',id).single();if(error||!o){w.close();return alert('A proposta foi salva, mas não foi possível gerar o documento.')}
    const {data:p}=await sb.from('lead_proposals').select('*').eq('id',o.proposal_id).single();if(!p){w.close();return alert('A proposta vinculada não foi encontrada.')}
    proposalDocument(p,o,w);document.getElementById('spcOrderDialog')?.close();await window.renderSpcSlaKanban?.();
  };

  function individualSelection(person,kept,preferredProduct){
    const catalog=(window.LEAD_CATALOG?.individual||[]).filter(x=>x.person===person&&canon(x.flag)!=='PRODUTO BASE');
    const selection=[],missing=[];
    kept.forEach(name=>{
      const matches=catalog.filter(x=>same(x.flag,name));
      const item=matches.find(x=>x.product===preferredProduct)||matches.find(x=>x.product==='SPC Mercado')||matches[0];
      if(item&&!selection.some(x=>x.product===item.product&&same(x.flag,item.flag)))selection.push({product:item.product,flag:item.flag});else if(!item)missing.push(name);
    });
    return {selection,missing};
  }

  async function revisedCommercialData(p,o,kept){
    let mode=p.mode,selection;
    if(p.mode==='combo'){
      const combo=(window.LEAD_CATALOG?.combos||[]).find(x=>x.person===p.person&&norm(x.level)===norm(p.selection?.level));
      const base=combo?.items||[],removedBase=base.some(x=>!kept.some(y=>same(x,y)));
      if(!removedBase){selection={level:p.selection?.level,addons:(p.selection?.addons||[]).filter(x=>kept.some(y=>same(x,y)))}}
      else{
        mode='individual';
        const mapped=individualSelection(p.person,kept,o.product);
        if(mapped.missing.length)throw new Error(`Não foi possível precificar automaticamente: ${mapped.missing.join(', ')}.`);
        selection=mapped.selection;
      }
    }else{
      selection=(p.selection||[]).filter(x=>kept.some(y=>same(x.flag||x.name||x,y)));
      const represented=selection.map(x=>x.flag||x.name||x),missing=kept.filter(x=>!represented.some(y=>same(x,y)));
      if(missing.length){const mapped=individualSelection(p.person,missing,o.product);if(mapped.missing.length)throw new Error(`Não foi possível precificar automaticamente: ${mapped.missing.join(', ')}.`);selection=[...selection,...mapped.selection]}
    }
    if(!selection||(Array.isArray(selection)&&!selection.length))throw new Error('A proposta precisa manter pelo menos uma variável.');
    const {data,error}=await sb.rpc('calculate_lead_quote',{p_mode:mode,p_person:p.person,p_qty:Number(p.quantity||p.quote?.quantity||o.client?.quantity||0),p_selection:selection});
    if(error||!data)throw new Error(error?.message||'Não foi possível recalcular a proposta.');
    const extras=Array.isArray(p.quote?.spc_other_products)?p.quote.spc_other_products:[],extraTotal=extras.reduce((sum,x)=>sum+Number(x.sale_total||0),0),discount=Number(p.quote?.discount_percent||0),gross=Number(data.sale_total||0)+extraTotal;
    let quote={...data,spc_other_products:extras};
    if(extras.length){quote.items=[...(data.items||[]),...extras.map(x=>({name:`Outro produto — ${x.name}`,commercial_unit:Number(x.commercial_unit||0)}))]}
    if(discount>0){const pct=Math.min(100,Math.max(0,discount))/100;quote={...quote,gross_sale_total:gross,gross_sale_unit:gross/Number(quote.quantity||1),discount_percent:discount,discount_amount:Number((gross*pct).toFixed(2)),sale_total:Number((gross*(1-pct)).toFixed(2)),sale_unit:Number(((gross*(1-pct))/Number(quote.quantity||1)).toFixed(4)),items:(quote.items||[]).map(i=>({...i,commercial_unit:Number((Number(i.commercial_unit||0)*(1-pct)).toFixed(4))})),_discount_applied:true}}
    else if(extras.length){quote.sale_total=Number(gross.toFixed(2));quote.sale_unit=Number((gross/Number(quote.quantity||1)).toFixed(4))}
    return {mode,selection,quote};
  }

  async function saveRevision(id,originalSave,args){
    const silent=args[1]===true;
    const {original,kept,removed}=removedFields();if(!removed.length)return originalSave.apply(this,args);
    if(!kept.length){alert('Mantenha pelo menos uma variável na proposta.');return false}
    const [{data:o,error:orderError},{data:{user}}]=await Promise.all([sb.from('spc_data_orders').select('*').eq('id',id).single(),sb.auth.getUser()]);
    if(orderError||!o){alert('Não foi possível carregar a Ordem SPC.');return false}
    const {data:p,error:proposalError}=await sb.from('lead_proposals').select('*').eq('id',o.proposal_id).single();
    if(proposalError||!p){alert('Não foi possível carregar a proposta vinculada.');return false}
    let commercial;try{commercial=await revisedCommercialData(p,o,kept)}catch(error){console.error(error);alert(error.message);return false}
    const affected=criteriaAffected(removed,o),stage=document.getElementById('soStage'),requestedStage=stage?.value||o.stage;
    if(affected.length&&stage)stage.value='Recontagem';
    const ok=await originalSave.call(this,id,true);if(ok===false){if(stage)stage.value=requestedStage;return false}
    const now=new Date().toISOString(),history=[...(Array.isArray(o.filters?.proposal_revision_history)?o.filters.proposal_revision_history:[]),{changed_at:now,changed_by:user?.id||null,note:document.getElementById('soProposalRevisionNote')?.value.trim()||'',removed_fields:removed,kept_fields:kept,requires_recount:Boolean(affected.length),criteria_affected:affected,original_proposal:{mode:p.mode,selection:p.selection,quote:p.quote},original_count:{reference:o.count_reference,result:o.count_result,returned_at:o.count_returned_at,notes:o.count_notes}}];
    const proposalUpdate=await sb.from('lead_proposals').update({mode:commercial.mode,selection:commercial.selection,quote:commercial.quote}).eq('id',p.id);
    if(proposalUpdate.error){console.error(proposalUpdate.error);alert('A ordem foi salva, mas a proposta não pôde ser atualizada: '+proposalUpdate.error.message);return false}
    const {data:savedOrder}=await sb.from('spc_data_orders').select('client,filters,recount_reason').eq('id',id).single();
    const client={...(savedOrder?.client||o.client||{}),mode:commercial.mode,combo_level:commercial.mode==='combo'?commercial.selection?.level:'',combo_addons:commercial.mode==='combo'?(commercial.selection?.addons||[]):[]};
    const orderUpdate=await sb.from('spc_data_orders').update({requested_fields:kept,client,filters:{...(savedOrder?.filters||o.filters||{}),proposal_revision_history:history},recount_reason:affected.length?`Recontagem após revisão da proposta: ${affected.join(', ')}`:(savedOrder?.recount_reason||o.recount_reason)}).eq('id',id);
    if(orderUpdate.error){console.error(orderUpdate.error);alert('A proposta foi atualizada, mas o histórico da ordem não pôde ser concluído: '+orderUpdate.error.message);return false}
    if(!silent){
      document.getElementById('spcOrderDialog')?.close();
      if(affected.length)alert(`Proposta atualizada para ${moneyValue(commercial.quote.sale_total)}. A contagem original foi preservada e a ordem foi encaminhada para Recontagem porque a remoção afetou: ${affected.join(', ')}.`);
      else alert(`Proposta atualizada para ${moneyValue(commercial.quote.sale_total)}. A contagem original foi preservada e a validação pode seguir normalmente.`);
    }
    await window.renderSpcSlaKanban?.();
    return true;
  }

  async function decorate(id){
    const [{data:o},{data:p}]=await Promise.all([
      sb.from('spc_data_orders').select('*').eq('id',id).single(),
      sb.from('spc_data_orders').select('proposal_id').eq('id',id).single().then(r=>r.data?.proposal_id?sb.from('lead_proposals').select('*').eq('id',r.data.proposal_id).single():({data:null}))
    ]);
    if(!o||!p)return;
    const entries=proposalEntries(p),recount=Boolean(o.parent_order_id)||Number(o.revision_number||1)>1;
    if(o.stage==='Validar contagem')enableValidationReview(id,p,o,entries);
    else if(!recount)lockDialog(entries,'Atributos definidos na proposta. Para remover variáveis após o retorno do SPC, utilize a etapa Validar contagem.');
    else{
      const note=[...document.querySelectorAll('#spcOrderDialog h3')].find(x=>x.textContent.includes('Atributos que o SPC deve retornar'))?.nextElementSibling;
      if(note?.classList.contains('muted'))note.textContent='Recontagem: revise os atributos antes de reenviar a solicitação ao SPC.';
    }
    renderRevisionHistory(o);
  }

  function patch(){
    if(typeof window.editSpcOrder!=='function'||window.editSpcOrder.__proposalReview)return false;
    const originalEdit=window.editSpcOrder;
    window.editSpcOrder=async function(id){const r=await originalEdit.apply(this,arguments);await decorate(id);return r};
    window.editSpcOrder.__proposalReview=true;
    const originalSave=window.saveSpcOrder;
    window.saveSpcOrder=async function(id,silent=false){
      const review=document.getElementById('soProposalReviewOriginal');
      if(!review)return originalSave.apply(this,arguments);
      return saveRevision.call(this,id,originalSave,arguments);
    };
    return true;
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(patch()||tries>40)clearInterval(timer)},150);

  if(!document.querySelector('script[data-spc-print-complete]')){
    const s=document.createElement('script');s.src='spc-orders-print-complete.js?v=20260917-regions-ticket1';s.dataset.spcPrintComplete='1';document.head.appendChild(s);
  }
})();
