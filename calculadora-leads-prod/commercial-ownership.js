// Funil comercial compartilhado com responsável por solicitação e proposta.
(() => {
  const requestFlow=['Pendente','Validação da proposta junto ao SPC Brasil'];
  const proposalFlow=['Validação da proposta junto ao SPC Brasil','Proposta enviada','Proposta fechada'];
  const operationalProposalStages=new Set(['Validação dos dados SPC Brasil','Aguardando envio da compra de leads do SPC Brasil','Compra de leads enviada para o cliente','Dados enviados ao cliente']);
  const terminal=new Set(['Negócio perdido','Perdida','Cancelada','Encerrada','Compra de leads enviada para o cliente','Dados enviados ao cliente']);
  const legacyInactive=new Set(['Negócio perdido','Perdida','Cancelada','Inativa','Inativo']);
  const state={requestView:'kanban',proposalView:'kanban',requestOwner:'open',proposalOwner:'open',requestScope:'active',proposalScope:'active',users:[],userId:'',role:'',loaded:false};
  window.currentRequestOwnerId=window.currentRequestOwnerId||null;

  const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sameText=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
  const normalized=s=>typeof flowStatus==='function'?flowStatus(s):s;
  const proposalStatus=s=>operationalProposalStages.has(normalized(s))?'Proposta fechada':normalized(s);
  const visibleStatus=(row,type)=>type==='proposal'?proposalStatus(row.status):normalized(row.status);
  const proposalRank=s=>proposalFlow.indexOf(proposalStatus(s));
  const recordOwner=(row,type)=>type==='proposal'?(row.assigned_to||row.created_by||''):(row.handled_by||'');
  const userName=id=>state.users.find(u=>u.id===id)?.name||state.users.find(u=>u.id===id)?.email||'Sem responsável';
  const manager=()=>['manager','admin'].includes(state.role);
  const admin=()=>state.role==='admin';
  const inactive=row=>row?.active===false||Boolean(row?.inactivated_at)||legacyInactive.has(String(row?.status||''));
  const canOperate=(row,type)=>manager()||!recordOwner(row,type)||recordOwner(row,type)===state.userId;
  const proposalPrice=row=>row.quote?.sale_total===null||row.quote?.sale_total===undefined?'Valor não registrado':money(row.quote.sale_total);
  const numeric=v=>Number(v||0);

  function sameOpportunity(a,b,maxDays=60){
    const ac=a?.client||{},bc=b?.client||{},sameIdentity=(ac.doc&&sameText(ac.doc,bc.doc))||(ac.email&&sameText(ac.email,bc.email))||(ac.company&&sameText(ac.company,bc.company)&&(sameText(ac.contact,bc.contact)||sameText(ac.email,bc.email)));
    if(!sameIdentity||numeric(a?.quantity)!==numeric(b?.quantity))return false;
    const aTime=new Date(a?.created_at||0).getTime(),bTime=new Date(b?.created_at||0).getTime();
    return !aTime||!bTime||Math.abs(aTime-bTime)<=maxDays*86400000;
  }

  function linkedProposal(request,proposals){
    const matches=(proposals||[]).filter(proposal=>proposal.client?.source_request_id===request.id||sameOpportunity(request,proposal));
    return matches.sort((a,b)=>Number(inactive(a))-Number(inactive(b))||proposalRank(b.status)-proposalRank(a.status)||Number(Boolean(a.client?.promoted_from_request))-Number(Boolean(b.client?.promoted_from_request))||new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null;
  }

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
    return `<select onchange="changeCommercialStatus('${type}','${row.id}',this.value)">${flow.map(s=>`<option ${visibleStatus(row,type)===s?'selected':''}>${html(s)}</option>`).join('')}</select>`;
  }

  function actions(row,type){
    if(inactive(row))return admin()?`<button class="secondary" onclick="setCommercialRecordActive('${type}','${row.id}',true,'${html(row.code)}')">Reativar</button>`:'';
    if(type==='request')return `<button class="ghost" onclick="viewRequest('${row.id}')">Ver solicitação</button>${canOperate(row,type)?`<button class="secondary" onclick="loadRequestFromKanban('${row.id}')">${recordOwner(row,type)?'Orçar':'Assumir e orçar'}</button>`:''}${admin()?`<button class="danger" onclick="setCommercialRecordActive('request','${row.id}',false,'${html(row.code)}')">Inativar</button>`:''}`;
    if(admin())return `<button class="ghost" onclick="editProposal('${row.id}')">Editar</button><button class="danger" onclick="setCommercialRecordActive('proposal','${row.id}',false,'${html(row.code)}')">Inativar</button>`;
    return '';
  }

  function filterRows(rows,type){
    const scope=state[`${type}Scope`];
    if(scope==='inactive')return rows.filter(inactive);
    if(scope==='all')return rows;
    const value=state[`${type}Owner`];
    const open=rows.filter(row=>!inactive(row)&&!terminal.has(visibleStatus(row,type))&&(type!=='request'||requestFlow.includes(visibleStatus(row,type))));
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
    const scope=state[`${type}Scope`];
    return `<style>.commercial-owner{margin:9px 0;padding:7px 9px;border-radius:9px;background:#eef6ff;color:#25476f;font-size:11px}.commercial-owner.empty{background:#fff4e5;color:#8a4b08}.commercial-owner-select{padding:8px;font-size:12px}.commercial-filter{width:auto;min-width:220px;padding:9px 11px}.commercial-team-note{font-size:13px;color:#667085;margin-bottom:9px}</style><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px"><div><div class="commercial-team-note">Toda a equipe visualiza o funil. O responsável indica quem está conduzindo o atendimento.</div><div style="display:flex;gap:8px;flex-wrap:wrap">${scope==='active'?filterSelect(type):''}${admin()?`<select class="commercial-filter" onchange="setCommercialRecordScope('${type}',this.value)"><option value="active" ${scope==='active'?'selected':''}>Registros ativos</option><option value="inactive" ${scope==='inactive'?'selected':''}>Registros inativos</option><option value="all" ${scope==='all'?'selected':''}>Todos os registros</option></select>`:''}</div></div><div class="tabs" style="margin:0"><button class="tab ${view==='kanban'&&scope==='active'?'active':''}" onclick="setCommercialTeamView('${type}','kanban')">Kanban</button><button class="tab ${view==='history'||scope!=='active'?'active':''}" onclick="setCommercialTeamView('${type}','history')">Histórico</button></div></div>`;
  }

  function card(row,type){
    const client=row.client||{},proposal=type==='proposal';
    return `<article class="kanban-card"><div class="card-code">${html(row.code)}</div><h4>${html(client.company||'Cliente não informado')}</h4><div class="card-meta">${html(client.contact||'')}${client.contact&&client.email?' • ':''}${html(client.email||'')}</div><div class="card-meta">${proposal?`${row.mode==='individual'?'Individual':'Combo'} • ${num(row.quantity)} leads • <b>${proposalPrice(row)}</b>`:`${html(row.person)} • ${num(row.quantity)} leads`}</div><div class="card-meta">${new Date(row.created_at).toLocaleDateString('pt-BR')}</div>${ownerEditor(row,type)}<label class="card-label">Etapa</label>${statusEditor(row,type)}<div class="card-actions">${actions(row,type)}</div></article>`;
  }

  function board(rows,type){
    const flow=type==='proposal'?proposalFlow:requestFlow;
    return `<div class="kanban" style="grid-template-columns:repeat(${flow.length},minmax(245px,1fr));overflow-x:auto">${flow.map(stage=>{const list=rows.filter(row=>visibleStatus(row,type)===stage);return `<div class="kanban-col"><div class="kanban-head"><b>${html(stage)}</b><span>${list.length}</span></div><div class="kanban-stack">${list.length?list.map(row=>card(row,type)).join(''):'<div class="kanban-empty">Nenhum registro</div>'}</div></div>`}).join('')}</div>`;
  }

  function table(rows,type){
    const proposal=type==='proposal';
    return rows.length?`<div style="overflow:auto"><table class="proposal-table"><thead><tr><th>Código</th><th>Cliente</th><th>${proposal?'Tipo':'Necessidade'}</th><th>Quantidade</th>${proposal?'<th>Valor</th>':''}<th>Responsável</th><th>Data</th><th>Etapa</th><th>Ações</th></tr></thead><tbody>${rows.map(row=>{const client=row.client||{};return `<tr><td><b>${html(row.code)}</b></td><td>${html(client.company||'—')}<br><span class="muted">${html(client.contact||'')}</span></td><td>${proposal?(row.mode==='individual'?'Individual':'Combo'):html(row.person)}</td><td>${num(row.quantity)}</td>${proposal?`<td><b>${proposalPrice(row)}</b></td>`:''}<td>${ownerEditor(row,type)}</td><td>${new Date(row.created_at).toLocaleDateString('pt-BR')}</td><td>${statusEditor(row,type)}</td><td><div class="card-actions" style="margin:0">${actions(row,type)}</div></td></tr>`}).join('')}</tbody></table></div>`:'<p class="muted">Nenhum registro encontrado para este filtro.</p>';
  }

  async function renderRequests(){
    await loadContext();
    const box=document.getElementById('requestList');if(!box)return;
    box.innerHTML='<p class="muted">Carregando solicitações…</p>';
    const {data,error}=await sb.from('lead_quote_requests').select('*').order('created_at',{ascending:false}).limit(500);
    if(error){console.error(error);box.innerHTML='<p class="muted">Não foi possível carregar as solicitações.</p>';return}
    const rows=filterRows(data||[],'request'),history=state.requestScope!=='active'||state.requestView==='history';
    box.innerHTML=toolbar('request')+(history?table(rows,'request'):board(rows,'request'));
  }

  async function cleanupAutoPromotedDuplicates(proposals){
    for(const duplicate of proposals.filter(row=>!inactive(row)&&row.client?.promoted_from_request===true)){
      const original=proposals.find(row=>row.id!==duplicate.id&&!inactive(row)&&row.client?.promoted_from_request!==true&&sameOpportunity(row,duplicate,14));
      if(!original)continue;
      let error=null;
      if(admin())error=await persistActive('proposal',duplicate.id,false);
      if(error){console.error('Não foi possível inativar a proposta automática duplicada.',duplicate.code,error);continue}
      duplicate.active=false;
      duplicate.inactivated_at=new Date().toISOString();
    }
  }

  async function renderProposals(){
    await loadContext();
    const box=document.getElementById('historyList');if(!box)return;
    box.innerHTML='<p class="muted">Carregando propostas…</p>';
    const result=await sb.from('lead_proposals').select('*').order('created_at',{ascending:false}).limit(500);
    if(result.error){console.error(result.error);box.innerHTML='<p class="muted">Não foi possível carregar as propostas.</p>';return}
    const allRows=result.data||[];await cleanupAutoPromotedDuplicates(allRows);await reconcileExistingProposalStages(allRows);const rows=filterRows(allRows,'proposal'),history=state.proposalScope!=='active'||state.proposalView==='history';
    box.innerHTML=toolbar('proposal')+(history?table(rows,'proposal'):board(rows,'proposal'));
  }

  window.setCommercialTeamView=(type,view)=>{state[`${type}View`]=view;type==='proposal'?renderProposals():renderRequests()};
  window.setCommercialOwnerFilter=(type,value)=>{state[`${type}Owner`]=value;type==='proposal'?renderProposals():renderRequests()};
  window.setCommercialRecordScope=(type,value)=>{state[`${type}Scope`]=value;type==='proposal'?renderProposals():renderRequests()};
  window.changeCommercialOwner=async(type,id,userId)=>{const {error}=await sb.rpc('assign_commercial_owner',{p_record_type:type,p_record_id:id,p_user_id:userId||null});if(error){console.error(error);alert(error.message||'Não foi possível atribuir o responsável.');return}type==='proposal'?renderProposals():renderRequests()};

  async function persistActive(type,id,active){
    const tableName=type==='proposal'?'lead_proposals':'lead_quote_requests',rpc=type==='proposal'?'admin_set_proposal_active':'admin_set_quote_request_active',args=type==='proposal'?{p_proposal_id:id,p_active:active}:{p_request_id:id,p_active:active};
    let {error}=await sb.rpc(rpc,args);
    if(error){
      console.warn(`Falha na função ${rpc}; tentando atualização administrativa direta.`,error);
      const {data:{user}}=await sb.auth.getUser();
      const payload={active,inactivated_at:active?null:new Date().toISOString(),inactivated_by:active?null:(user?.id||state.userId),updated_at:new Date().toISOString()};
      ({error}=await sb.from(tableName).update(payload).eq('id',id));
      if(error&&/active|inactivated_at|inactivated_by|column|schema cache/i.test(String(error.message||''))){
        const legacyStatus=active?(type==='proposal'?'Proposta enviada':'Pendente'):(type==='proposal'?'Cancelada':'Negócio perdido');
        ({error}=await sb.from(tableName).update({status:legacyStatus,updated_at:new Date().toISOString()}).eq('id',id));
      }
    }
    return error;
  }

  window.setCommercialRecordActive=async(type,id,active,code)=>{
    if(!admin())return alert('Ação exclusiva do administrador.');
    if(!confirm(`${active?'Reativar':'Inativar'} ${type==='proposal'?'a proposta':'a solicitação'} ${code}?`))return;
    const tableName=type==='proposal'?'lead_proposals':'lead_quote_requests',error=await persistActive(type,id,active);
    if(error){console.error(error);return alert(`Não foi possível ${active?'reativar':'inativar'} o registro. Detalhe: ${error.message||'erro do Supabase'}`)}
    if(active){
      const {data:restored}=await sb.from(tableName).select('status').eq('id',id).maybeSingle();
      if(legacyInactive.has(String(restored?.status||'')))await sb.from(tableName).update({status:type==='proposal'?'Proposta enviada':'Pendente',updated_at:new Date().toISOString()}).eq('id',id);
    }
    type==='proposal'?renderProposals():renderRequests();
  };

  window.showRequests=async open=>{if(open===false)return;await renderRequests()};
  window.showHistory=async open=>{if(open===false)return;await renderProposals()};

  async function createProposalFromRequest(request){
    const {data:{user}}=await sb.auth.getUser(),client={...(request.client||{}),source_request_id:request.id,promoted_from_request:true},quote={mode:request.mode,person:request.person,quantity:Number(request.quantity||0),band:'',sale_total:null,sale_unit:null,items:[]},payload={created_by:user?.id||state.userId,status:'Proposta enviada',mode:request.mode,person:request.person,quantity:Number(request.quantity||0),client,selection:request.selection||(request.mode==='combo'?{level:'Básico',addons:[]}:[]),quote};
    const {data,error}=await sb.from('lead_proposals').insert(payload).select('*').single();
    if(error){console.error(error);return null}
    const owner=request.handled_by||state.userId||null;if(owner){const assigned=await sb.from('lead_proposals').update({assigned_to:owner}).eq('id',data.id);if(!assigned.error)data.assigned_to=owner;else if(!/assigned_to|column/i.test(String(assigned.error.message||'')))console.error(assigned.error)}
    return data;
  }

  async function reconcileExistingProposalStages(proposals){
    const {data:requests,error}=await sb.from('lead_quote_requests').select('*').order('created_at',{ascending:false}).limit(500);
    if(error){console.error(error);return}
    for(const request of (requests||[]).filter(item=>!inactive(item)&&normalized(item.status)==='Proposta enviada')){
      let proposal=linkedProposal(request,proposals);
      if(!proposal){proposal=await createProposalFromRequest(request);if(proposal)proposals.push(proposal);continue}
      if(inactive(proposal))continue;
      const client={...(proposal.client||{}),source_request_id:request.id},status=proposalStatus(proposal.status)==='Validação da proposta junto ao SPC Brasil'?'Proposta enviada':proposal.status;
      if(proposal.client?.source_request_id!==request.id||status!==proposal.status){
        const {error:updateError}=await sb.from('lead_proposals').update({status,client,updated_at:new Date().toISOString()}).eq('id',proposal.id);
        if(updateError)console.error(updateError);else{proposal.status=status;proposal.client=client}
      }
    }
  }

  async function proposalLinkedToRequest(request){
    const {data,error}=await sb.from('lead_proposals').select('id,status,client,quantity,active,inactivated_at,created_at').order('created_at',{ascending:false}).limit(500);
    if(error){console.error(error);return null}
    return linkedProposal(request,data||[]);
  }

  const previousStatusChange=window.changeCommercialStatus;
  if(typeof previousStatusChange==='function')window.changeCommercialStatus=async function(type,id,status){
    if(type!=='request')return previousStatusChange.apply(this,arguments);
    const {data:request,error}=await sb.from('lead_quote_requests').select('*').eq('id',id).maybeSingle();
    if(error||!request){console.error(error);return alert('Não foi possível carregar a solicitação para alterar a etapa.')}
    const result=await previousStatusChange.apply(this,arguments);
    if(['Validação da proposta junto ao SPC Brasil','Proposta enviada'].includes(status)){
      let proposal=await proposalLinkedToRequest(request);if(!proposal&&status==='Proposta enviada')proposal=await createProposalFromRequest({...request,status});
      if(proposal&&!inactive(proposal)){const client={...(proposal.client||{}),source_request_id:request.id},nextStatus=proposalRank(status)>proposalRank(proposal.status)?status:proposal.status,{error:updateError}=await sb.from('lead_proposals').update({status:nextStatus,client,updated_at:new Date().toISOString()}).eq('id',proposal.id);if(updateError){console.error(updateError);alert('A solicitação foi atualizada, mas não foi possível sincronizar a proposta.')}else if(status==='Proposta enviada')await renderProposals()}
      else if(status==='Proposta enviada'){await sb.from('lead_quote_requests').update({status:'Validação da proposta junto ao SPC Brasil',updated_at:new Date().toISOString()}).eq('id',id);alert('Não foi possível criar a proposta vinculada. A solicitação voltou para validação para não desaparecer do fluxo.');await renderRequests()}
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
