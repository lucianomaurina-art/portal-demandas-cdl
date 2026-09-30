// Funil comercial compartilhado com responsável por solicitação e proposta.
(() => {
  const requestFlow=['Pendente','Validação da proposta junto ao SPC Brasil','Proposta enviada'];
  const proposalFlow=['Validação da proposta junto ao SPC Brasil','Proposta enviada','Proposta fechada','Validação dos dados SPC Brasil','Aguardando envio da compra de leads do SPC Brasil','Dados enviados ao cliente'];
  const terminal=new Set(['Negócio perdido','Perdida','Cancelada','Encerrada','Compra de leads enviada para o cliente','Dados enviados ao cliente']);
  const state={requestView:'kanban',proposalView:'kanban',requestOwner:'open',proposalOwner:'open',users:[],userId:'',role:'',loaded:false};
  window.currentRequestOwnerId=window.currentRequestOwnerId||null;

  const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sameText=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
  const normalized=s=>typeof flowStatus==='function'?flowStatus(s):s;
  const recordOwner=(row,type)=>type==='proposal'?(row.assigned_to||row.created_by||''):(row.handled_by||'');
  const userName=id=>state.users.find(u=>u.id===id)?.name||state.users.find(u=>u.id===id)?.email||'Sem responsável';
  const manager=()=>['manager','admin'].includes(state.role);
  const canOperate=(row,type)=>manager()||!recordOwner(row,type)||recordOwner(row,type)===state.userId;

  async function loadContext(force=false){
    if(state.loaded&&!force)return;
    if(typeof loadCurrentRole==='function')await loadCurrentRole();
    const {data:{user}}=await sb.auth.getUser();
    state.userId=user?.id||'';
    const {data:profile}=state.userId?await sb.from('profiles').select('role').eq('id',state.userId).maybeSingle():{data:null};
    state.role=profile?.role||'';
    const {data,error}=await sb.rpc('list_active_commercial_users');
    if(!error)state.users=data||[];
    else if(user)state.users=[{id:user.id,email:user.email,name:user.email?.split('@')[0]||'Meu usuário',role:state.role}];
    state.loaded=true;
  }

  function ownerEditor(row,type){
    const id=recordOwner(row,type);
    if(!manager())return `<div class="commercial-owner ${id?'':'empty'}"><b>Responsável:</b> ${html(userName(id))}</div>`;
    return `<label class="card-label">Vendedor responsável</label><select class="commercial-owner-select" onchange="changeCommercialOwner('${type}','${row.id}',this.value)"><option value="">Sem responsável</option>${state.users.map(u=>`<option value="${u.id}" ${u.id===id?'selected':''}>${html(u.name||u.email)}</option>`).join('')}</select>`;
  }

  function statusEditor(row,type){
    if(!canOperate(row,type))return `<span class="status-pill">${html(normalized(row.status))}</span>`;
    const flow=type==='proposal'?proposalFlow:requestFlow;
    return `<select onchange="changeCommercialStatus('${type}','${row.id}',this.value)">${flow.map(s=>`<option ${normalized(row.status)===s?'selected':''}>${html(s)}</option>`).join('')}</select>`;
  }

  function actions(row,type){
    if(type==='request')return `<button class="ghost" onclick="viewRequest('${row.id}')">Ver solicitação</button>${canOperate(row,type)?`<button class="secondary" onclick="loadRequestFromKanban('${row.id}')">${recordOwner(row,type)?'Orçar':'Assumir e orçar'}</button>`:''}`;
    if(state.role==='admin')return `<button class="ghost" onclick="editProposal('${row.id}')">Editar</button><button class="danger" onclick="deleteProposal('${row.id}','${html(row.code)}')">Excluir</button>`;
    return '';
  }

  function filterRows(rows,type){
    const value=state[`${type}Owner`];
    const open=rows.filter(row=>row.active!==false&&!terminal.has(normalized(row.status)));
    if(value==='open')return open;
    if(value==='mine')return open.filter(row=>recordOwner(row,type)===state.userId);
    if(value==='unassigned')return open.filter(row=>!recordOwner(row,type));
    return open.filter(row=>recordOwner(row,type)===value);
  }

  function filterSelect(type){
    const value=state[`${type}Owner`];
    return `<select class="commercial-filter" onchange="setCommercialOwnerFilter('${type}',this.value)"><option value="open" ${value==='open'?'selected':''}>Todos em aberto</option><option value="mine" ${value==='mine'?'selected':''}>Meus atendimentos</option><option value="unassigned" ${value==='unassigned'?'selected':''}>Sem responsável</option>${state.users.map(u=>`<option value="${u.id}" ${value===u.id?'selected':''}>${html(u.name||u.email)}</option>`).join('')}</select>`;
  }

  function toolbar(type){
    const view=state[`${type}View`];
    return `<style>.commercial-owner{margin:9px 0;padding:7px 9px;border-radius:9px;background:#eef6ff;color:#25476f;font-size:11px}.commercial-owner.empty{background:#fff4e5;color:#8a4b08}.commercial-owner-select{padding:8px;font-size:12px}.commercial-filter{width:auto;min-width:220px;padding:9px 11px}.commercial-team-note{font-size:13px;color:#667085;margin-bottom:9px}</style><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px"><div><div class="commercial-team-note">Toda a equipe visualiza o funil. O responsável indica quem está conduzindo o atendimento.</div>${filterSelect(type)}</div><div class="tabs" style="margin:0"><button class="tab ${view==='kanban'?'active':''}" onclick="setCommercialTeamView('${type}','kanban')">Kanban</button><button class="tab ${view==='history'?'active':''}" onclick="setCommercialTeamView('${type}','history')">Histórico</button></div></div>`;
  }

  function card(row,type){
    const client=row.client||{},proposal=type==='proposal';
    return `<article class="kanban-card"><div class="card-code">${html(row.code)}</div><h4>${html(client.company||'Cliente não informado')}</h4><div class="card-meta">${html(client.contact||'')}${client.contact&&client.email?' • ':''}${html(client.email||'')}</div><div class="card-meta">${proposal?`${row.mode==='individual'?'Individual':'Combo'} • ${num(row.quantity)} leads • <b>${money(row.quote?.sale_total)}</b>`:`${html(row.person)} • ${num(row.quantity)} leads`}</div><div class="card-meta">${new Date(row.created_at).toLocaleDateString('pt-BR')}</div>${ownerEditor(row,type)}<label class="card-label">Etapa</label>${statusEditor(row,type)}<div class="card-actions">${actions(row,type)}</div></article>`;
  }

  function board(rows,type){
    const flow=type==='proposal'?proposalFlow:requestFlow;
    return `<div class="kanban" style="grid-template-columns:repeat(${flow.length},minmax(245px,1fr));overflow-x:auto">${flow.map(stage=>{const list=rows.filter(row=>normalized(row.status)===stage);return `<div class="kanban-col"><div class="kanban-head"><b>${html(stage)}</b><span>${list.length}</span></div><div class="kanban-stack">${list.length?list.map(row=>card(row,type)).join(''):'<div class="kanban-empty">Nenhum registro</div>'}</div></div>`}).join('')}</div>`;
  }

  function table(rows,type){
    const proposal=type==='proposal';
    return rows.length?`<div style="overflow:auto"><table class="proposal-table"><thead><tr><th>Código</th><th>Cliente</th><th>${proposal?'Tipo':'Necessidade'}</th><th>Quantidade</th>${proposal?'<th>Valor</th>':''}<th>Responsável</th><th>Data</th><th>Etapa</th><th>Ações</th></tr></thead><tbody>${rows.map(row=>{const client=row.client||{};return `<tr><td><b>${html(row.code)}</b></td><td>${html(client.company||'—')}<br><span class="muted">${html(client.contact||'')}</span></td><td>${proposal?(row.mode==='individual'?'Individual':'Combo'):html(row.person)}</td><td>${num(row.quantity)}</td>${proposal?`<td><b>${money(row.quote?.sale_total)}</b></td>`:''}<td>${ownerEditor(row,type)}</td><td>${new Date(row.created_at).toLocaleDateString('pt-BR')}</td><td>${statusEditor(row,type)}</td><td><div class="card-actions" style="margin:0">${actions(row,type)}</div></td></tr>`}).join('')}</tbody></table></div>`:'<p class="muted">Nenhum registro em aberto para este filtro.</p>';
  }

  async function renderRequests(){
    await loadContext();
    const box=document.getElementById('requestList');if(!box)return;
    box.innerHTML='<p class="muted">Carregando solicitações…</p>';
    const {data,error}=await sb.from('lead_quote_requests').select('*').order('created_at',{ascending:false}).limit(500);
    if(error){console.error(error);box.innerHTML='<p class="muted">Não foi possível carregar as solicitações.</p>';return}
    const rows=filterRows(data||[],'request');
    box.innerHTML=toolbar('request')+(state.requestView==='kanban'?board(rows,'request'):table(rows,'request'));
  }

  async function renderProposals(){
    await loadContext();
    const box=document.getElementById('historyList');if(!box)return;
    box.innerHTML='<p class="muted">Carregando propostas…</p>';
    const result=await sb.from('lead_proposals').select('*').order('created_at',{ascending:false}).limit(500);
    if(result.error){console.error(result.error);box.innerHTML='<p class="muted">Não foi possível carregar as propostas.</p>';return}
    const allRows=result.data||[];await reconcileExistingProposalStages(allRows);const rows=filterRows(allRows,'proposal');
    box.innerHTML=toolbar('proposal')+(state.proposalView==='kanban'?board(rows,'proposal'):table(rows,'proposal'));
  }

  window.setCommercialTeamView=(type,view)=>{state[`${type}View`]=view;type==='proposal'?renderProposals():renderRequests()};
  window.setCommercialOwnerFilter=(type,value)=>{state[`${type}Owner`]=value;type==='proposal'?renderProposals():renderRequests()};
  window.changeCommercialOwner=async(type,id,userId)=>{const {error}=await sb.rpc('assign_commercial_owner',{p_record_type:type,p_record_id:id,p_user_id:userId||null});if(error){console.error(error);alert(error.message||'Não foi possível atribuir o responsável.');return}type==='proposal'?renderProposals():renderRequests()};

  window.showRequests=async open=>{if(open===false)return;await renderRequests()};
  window.showHistory=async open=>{if(open===false)return;await renderProposals()};

  async function reconcileExistingProposalStages(proposals){
    const {data:requests,error}=await sb.from('lead_quote_requests').select('id,status,client,created_at').eq('status','Proposta enviada').order('created_at',{ascending:false}).limit(500);
    if(error){console.error(error);return}
    const updates=[];(requests||[]).forEach(request=>{const client=request.client||{},requestAt=new Date(request.created_at||0).getTime(),proposal=proposals.find(item=>item.client?.source_request_id===request.id)||proposals.find(item=>{const other=item.client||{},proposalAt=new Date(item.created_at||0).getTime();return proposalAt>=requestAt&&((client.doc&&sameText(other.doc,client.doc))||(client.email&&sameText(other.email,client.email))||(client.company&&sameText(other.company,client.company)))});if(proposal&&normalized(proposal.status)==='Validação da proposta junto ao SPC Brasil'){proposal.status='Proposta enviada';proposal.client={...(proposal.client||{}),source_request_id:request.id};updates.push(sb.from('lead_proposals').update({status:'Proposta enviada',client:proposal.client,updated_at:new Date().toISOString()}).eq('id',proposal.id))}});
    if(updates.length)await Promise.all(updates);
  }

  async function proposalLinkedToRequest(request){
    const {data,error}=await sb.from('lead_proposals').select('id,status,client,created_at').order('created_at',{ascending:false}).limit(500);
    if(error){console.error(error);return null}
    const proposals=data||[],direct=proposals.find(proposal=>proposal.client?.source_request_id===request.id);if(direct)return direct;
    const client=request.client||{},createdAt=new Date(request.created_at||0).getTime();
    return proposals.find(proposal=>{const other=proposal.client||{},proposalAt=new Date(proposal.created_at||0).getTime(),sameDoc=client.doc&&sameText(other.doc,client.doc),sameEmail=client.email&&sameText(other.email,client.email),sameCompany=client.company&&sameText(other.company,client.company);return proposalAt>=createdAt&&(sameDoc||sameEmail||sameCompany)})||null;
  }

  const previousStatusChange=window.changeCommercialStatus;
  if(typeof previousStatusChange==='function')window.changeCommercialStatus=async function(type,id,status){
    if(type!=='request')return previousStatusChange.apply(this,arguments);
    const {data:request,error}=await sb.from('lead_quote_requests').select('*').eq('id',id).maybeSingle();
    if(error||!request){console.error(error);return alert('Não foi possível carregar a solicitação para alterar a etapa.')}
    const result=await previousStatusChange.apply(this,arguments);
    if(['Validação da proposta junto ao SPC Brasil','Proposta enviada'].includes(status)){
      const proposal=await proposalLinkedToRequest(request);
      if(proposal){const client={...(proposal.client||{}),source_request_id:request.id},{error:updateError}=await sb.from('lead_proposals').update({status,client,updated_at:new Date().toISOString()}).eq('id',proposal.id);if(updateError){console.error(updateError);alert('A solicitação foi atualizada, mas não foi possível sincronizar a proposta.')}else if(status==='Proposta enviada')await renderProposals()}
      else if(status==='Proposta enviada')alert('A solicitação foi atualizada, mas ainda não existe uma proposta gerada para ela. Abra a solicitação, clique em Orçar e gere a proposta.')
    }
    return result;
  };

  const previousLoad=window.loadRequestFromKanban;
  if(typeof previousLoad==='function')window.loadRequestFromKanban=async function(id){
    const {data:request}=await sb.from('lead_quote_requests').select('handled_by').eq('id',id).maybeSingle();
    const owner=request?.handled_by||state.userId;
    window.currentRequestOwnerId=owner||null;
    const out=await previousLoad.apply(this,arguments);
    if(request?.handled_by&&request.handled_by!==state.userId)await sb.from('lead_quote_requests').update({handled_by:request.handled_by}).eq('id',id);
    return out;
  };

  const previousSave=window.saveProposal;
  if(typeof previousSave==='function')window.saveProposal=async function(){
    const saved=await previousSave.apply(this,arguments);
    if(!saved?.id)return saved;
    const assignedTo=window.currentRequestOwnerId||state.userId||null;
    if(assignedTo){const {error}=await sb.from('lead_proposals').update({assigned_to:assignedTo}).eq('id',saved.id);if(error&&!/assigned_to|column/i.test(String(error.message||'')))console.error(error)}
    return saved;
  };
})();
