// Extensão isolada para propostas inativas.
// Não substitui showHistory, openSection ou a navegação estável.
(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>({'Nova':'Pendente','Em análise':'Pendente','Proposta gerada':'Validação da proposta junto ao SPC Brasil','Respondida':'Proposta enviada','Encerrada':'Dados enviados ao cliente','Rascunho':'Proposta enviada','Gerada':'Proposta enviada','Enviada':'Proposta enviada','Aprovada':'Proposta fechada','Compra de leads enviada para o cliente':'Dados enviados ao cliente'}[s]||s||'Pendente');
  const legacyInactive=x=>['Perdida','Cancelada','Inativa','Inativo'].includes(String(x.status||''));
  const admin=()=>typeof isAdmin==='function'&&isAdmin();
  let rendering=false;

  async function ensureAdmin(){
    try{if(typeof loadCurrentRole==='function')await loadCurrentRole();}catch(e){}
    return admin();
  }

  function injectButton(){
    if(rendering||!admin())return;
    const box=document.getElementById('historyList');
    if(!box||document.getElementById('safeInactiveProposalsBtn'))return;
    const anchor=box.querySelector('.tabs')||box.firstElementChild;
    if(!anchor)return;
    const wrap=document.createElement('div');
    wrap.id='safeInactiveProposalsControls';
    wrap.style.cssText='display:flex;gap:8px;align-items:center;margin:0 0 16px;flex-wrap:wrap';
    wrap.innerHTML='<button id="safeInactiveProposalsBtn" class="ghost" type="button">Ver propostas inativas</button>';
    box.insertBefore(wrap,box.firstChild);
    document.getElementById('safeInactiveProposalsBtn').onclick=window.showInactiveProposalsSafe;
  }

  window.showInactiveProposalsSafe=async function(){
    if(!await ensureAdmin())return alert('Ação exclusiva do administrador.');
    const box=document.getElementById('historyList');if(!box)return;
    rendering=true;
    box.innerHTML='<p class="muted">Carregando propostas inativas…</p>';
    const {data,error}=await sb.from('lead_proposals').select('*').order('created_at',{ascending:false}).limit(500);
    if(error){console.error(error);box.innerHTML='<p class="muted">Não foi possível carregar as propostas inativas.</p><button class="ghost" onclick="showHistory(true)">Voltar às propostas ativas</button>';rendering=false;return;}
    const all=data||[];
    const hasLogical=all.some(x=>Object.prototype.hasOwnProperty.call(x,'active'));
    const rows=all.filter(x=>hasLogical?x.active===false:legacyInactive(x));
    box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:18px;flex-wrap:wrap"><div><b>Propostas inativas</b><div class="muted" style="font-size:13px">Registros preservados para reativação e edição.</div></div><button class="ghost" onclick="showHistory(true)">Voltar às propostas ativas</button></div>${rows.length?`<div style="overflow:auto"><table class="proposal-table"><thead><tr><th>Código</th><th>Cliente</th><th>Tipo</th><th>Quantidade</th><th>Valor</th><th>Data</th><th>Etapa</th><th>Ações</th></tr></thead><tbody>${rows.map(x=>{const c=x.client||{};return `<tr><td><b>${esc(x.code)}</b></td><td>${esc(c.company||'—')}<br><span class="muted">${esc(c.contact||'')}</span></td><td>${x.mode==='individual'?'Individual':'Combo'}</td><td>${typeof num==='function'?num(x.quantity):esc(x.quantity)}</td><td><b>${typeof money==='function'?money(x.quote?.sale_total):esc(x.quote?.sale_total||'—')}</b></td><td>${new Date(x.created_at).toLocaleDateString('pt-BR')}</td><td>${esc(norm(x.status))}</td><td><div class="card-actions" style="margin:0"><button class="secondary" onclick="reactivateInactiveProposalSafe('${x.id}','${esc(x.code)}',false,${hasLogical})">Reativar</button><button class="primary" onclick="reactivateInactiveProposalSafe('${x.id}','${esc(x.code)}',true,${hasLogical})">Reativar e editar</button></div></td></tr>`}).join('')}</tbody></table></div>`:'<p class="muted">Nenhuma proposta inativa encontrada.</p>'}`;
    rendering=false;
  };

  window.reactivateInactiveProposalSafe=async function(id,code,editAfter,logical){
    if(!await ensureAdmin())return alert('Ação exclusiva do administrador.');
    if(!confirm(`Reativar a proposta ${code}?`))return;
    let error=null;
    if(logical){
      const res=await sb.rpc('admin_set_proposal_active',{p_proposal_id:id,p_active:true});error=res.error;
    }else{
      const res=await sb.from('lead_proposals').update({status:'Proposta enviada',updated_at:new Date().toISOString()}).eq('id',id);error=res.error;
    }
    if(error){console.error(error);return alert('Não foi possível reativar a proposta.');}
    if(editAfter&&typeof editProposal==='function'){await editProposal(id);return;}
    await window.showInactiveProposalsSafe();
  };

  const box=document.getElementById('historyList');
  if(box){new MutationObserver(()=>{if(!rendering)setTimeout(injectButton,0)}).observe(box,{childList:true,subtree:false});}
  setTimeout(async()=>{if(await ensureAdmin())injectButton();},900);
})();