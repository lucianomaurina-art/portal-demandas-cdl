// Kanban operacional das Ordens SPC com SLA máximo de 15 dias.
// 1d para envio da contagem + 7d SPC + 1d validação CDL + 6d SPC.
(()=>{
  const STAGES=[
    {key:'Solicitar contagem',label:'Preparar / enviar contagem',sla:'CDL • até 1 dia'},
    {key:'Contagem enviada ao SPC',label:'Contagem enviada ao SPC',sla:'SPC • até 7 dias'},
    {key:'Validar contagem',label:'Validar contagem',sla:'CDL • até 1 dia'},
    {key:'Aguardando planilha de dados',label:'Aguardando planilha de dados',sla:'SPC • até 6 dias'},
    {key:'Dados enviados ao cliente',label:'Dados enviados ao cliente',sla:'Concluído'}
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>v?new Date(v):null;
  const addDays=(v,n)=>{const d=date(v);return d?new Date(d.getTime()+n*86400000):null};
  const fmt=v=>{const d=date(v);return d&&!Number.isNaN(d.getTime())?d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'};
  const qty=v=>Number(v||0).toLocaleString('pt-BR');

  function stageDue(o){
    if(o.stage_due_at)return date(o.stage_due_at);
    if(o.stage==='Solicitar contagem')return addDays(o.proposal_closed_at||o.proposal_updated_at||o.created_at,1);
    if(o.stage==='Contagem enviada ao SPC')return addDays(o.count_sent_at||o.count_requested_at||o.updated_at,7);
    if(o.stage==='Validar contagem')return addDays(o.count_returned_at||o.updated_at,1);
    if(o.stage==='Aguardando planilha de dados')return addDays(o.production_requested_at||o.count_validated_at||o.updated_at,6);
    return null;
  }
  function overallDue(o){return date(o.overall_due_at)||addDays(o.proposal_closed_at||o.proposal_updated_at||o.created_at,15)}
  function state(o){
    if(o.stage==='Dados enviados ao cliente')return 'done';
    if(o.stage==='Cancelada')return 'cancelled';
    const due=stageDue(o);if(!due)return 'ok';
    const ms=due-Date.now();if(ms<0)return 'late';if(ms<=86400000)return 'warn';return 'ok';
  }
  function overallState(o){
    const due=overallDue(o);if(!due)return 'ok';
    if(o.stage==='Dados enviados ao cliente')return o.data_delivered_at&&date(o.data_delivered_at)>due?'late':'done';
    const ms=due-Date.now();if(ms<0)return 'late';if(ms<=86400000)return 'warn';return 'ok';
  }
  function remaining(due){
    if(!due)return 'Sem prazo calculado';
    const ms=due-Date.now(),late=ms<0,abs=Math.abs(ms),days=Math.floor(abs/86400000),hours=Math.floor((abs%86400000)/3600000);
    if(late)return `Atrasado há ${days?days+'d ':''}${hours}h`;
    return `Vence em ${days?days+'d ':''}${hours}h`;
  }
  function colorLabel(s){return s==='late'?'Atrasado':s==='warn'?'Atenção':s==='done'?'Concluído':'Em dia'}
  function stageInfo(stage){return STAGES.find(x=>x.key===stage)||{key:stage,label:stage,sla:''}}

  async function fetchOrders(){
    let r=await sb.from('spc_data_order_sla').select('*').eq('active',true).order('updated_at',{ascending:false});
    if(!r.error)return r.data||[];
    console.warn('View SLA ainda não disponível; usando tabela base.',r.error);
    r=await sb.from('spc_data_orders').select('*').eq('active',true).order('updated_at',{ascending:false});
    return r.data||[];
  }
  async function fetchPending(orders){
    const used=new Set(orders.map(o=>o.proposal_id));
    const {data}=await sb.from('lead_proposals').select('id,code,status,client,person,mode,quantity,selection,updated_at').eq('status','Proposta fechada').order('updated_at',{ascending:false});
    return (data||[]).filter(p=>!used.has(p.id));
  }

  function injectStyles(){
    if(document.getElementById('spcSlaKanbanStyle'))return;
    const s=document.createElement('style');s.id='spcSlaKanbanStyle';s.textContent=`
      .spc-sla-summary{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:10px;margin:14px 0 18px}.spc-sla-stat{border:1px solid #dce3ed;border-radius:13px;padding:12px;background:#fff}.spc-sla-stat b{display:block;font-size:22px;color:#071b33}.spc-sla-stat span{font-size:11px;color:#667085}.spc-sla-board{display:grid;grid-template-columns:repeat(5,minmax(245px,1fr));gap:12px;overflow-x:auto;padding:3px 1px 18px}.spc-sla-col{background:#f5f7fa;border:1px solid #dce3ed;border-radius:15px;min-height:460px;padding:10px}.spc-sla-col.dragover{outline:3px solid #b8d5ff;background:#eef6ff}.spc-sla-head{display:flex;justify-content:space-between;gap:8px;padding:7px 5px 10px}.spc-sla-head b{font-size:13px}.spc-sla-head small{display:block;color:#667085;margin-top:3px}.spc-sla-count{background:#fff;border:1px solid #dce3ed;border-radius:999px;height:max-content;padding:2px 7px;font-size:11px}.spc-sla-stack{display:grid;gap:9px}.spc-sla-card{background:#fff;border:1px solid #dce3ed;border-left:5px solid #25a56a;border-radius:12px;padding:12px;box-shadow:0 3px 12px rgba(12,35,64,.05)}.spc-sla-card.warn{border-left-color:#f5a524;background:#fffdf7}.spc-sla-card.late{border-left-color:#d92d20;background:#fff8f7}.spc-sla-card.done{border-left-color:#0b62d6;background:#f7fbff}.spc-sla-card.dragging{opacity:.5}.spc-sla-card h4{margin:5px 0 6px;font-size:14px}.spc-sla-code{font-size:10px;font-weight:900;color:#0b62d6}.spc-sla-meta{font-size:11px;color:#667085;line-height:1.45}.spc-sla-timer{margin-top:9px;border-radius:9px;padding:8px 9px;background:#eef8f3;color:#176b4d;font-size:11px;font-weight:800}.spc-sla-card.warn .spc-sla-timer{background:#fff4d9;color:#8a5a00}.spc-sla-card.late .spc-sla-timer{background:#feeceb;color:#b42318}.spc-sla-total{font-size:10px;color:#667085;margin-top:7px}.spc-sla-total strong.late{color:#b42318}.spc-sla-total strong.warn{color:#8a5a00}.spc-sla-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.spc-sla-actions button,.spc-sla-actions select{font-size:11px;padding:7px 8px;border-radius:9px}.spc-sla-actions select{border:1px solid #dce3ed;background:#fff;max-width:100%}.spc-sla-ready{margin:0 0 16px;padding:14px;border:1px solid #bfd4ee;background:#f4f8ff;border-radius:13px}.spc-sla-ready-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.spc-sla-ready-card{background:#fff;border:1px solid #dce3ed;border-radius:11px;padding:11px}.spc-sla-dialog{margin:12px 0;padding:13px;border:1px solid #bfd4ee;background:#f4f8ff;border-radius:12px}.spc-sla-dialog-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.spc-sla-dialog small{display:block;color:#667085}.spc-sla-dialog b{font-size:12px}@media(max-width:900px){.spc-sla-summary{grid-template-columns:repeat(2,1fr)}.spc-sla-ready-grid{grid-template-columns:1fr}.spc-sla-dialog-grid{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }

  function readyHtml(p){const c=p.client||{};return `<div class="spc-sla-ready-card"><div class="spc-sla-code">${esc(p.code||'PROPOSTA')}</div><h4>${esc(c.company||'Cliente')}</h4><div class="spc-sla-meta">${esc(p.person||'')} • ${qty(p.quantity)} leads<br>Fechada em ${fmt(p.updated_at)}</div><div class="spc-sla-actions"><button class="secondary" onclick="createSpcOrder('${p.id}')">Iniciar contagem</button></div></div>`}
  function cardHtml(o){
    const c=o.client||{},st=state(o),ost=overallState(o),due=stageDue(o),total=overallDue(o),info=stageInfo(o.stage);
    const opts=STAGES.map(x=>`<option value="${esc(x.key)}" ${x.key===o.stage?'selected':''}>${esc(x.label)}</option>`).join('');
    return `<article class="spc-sla-card ${st}" draggable="true" data-order="${o.id}"><div class="spc-sla-code">${esc(o.proposal_code||c.proposal_code||'ORDEM SPC')}</div><h4>${esc(c.company||'Cliente')}</h4><div class="spc-sla-meta">${esc(o.product||'SPC Dados')} • ${esc(o.person||'')}<br>${qty(c.quantity)} leads${o.count_result!=null?` • Contagem: ${qty(o.count_result)}`:''}</div>${due?`<div class="spc-sla-timer">${esc(colorLabel(st))} • ${esc(remaining(due))}<br><span style="font-weight:600">Prazo da etapa: ${esc(fmt(due))}</span></div>`:''}<div class="spc-sla-total">Entrega ao cliente até <strong class="${ost}">${esc(fmt(total))}</strong> • SLA total 15 dias</div><div class="spc-sla-actions"><button class="secondary" data-open="${o.id}">Abrir ordem</button><select data-stage="${o.id}" aria-label="Mover etapa">${opts}</select></div></article>`;
  }

  async function render(){
    const host=document.getElementById('spcOrdersList');
    if(!host||document.getElementById('spcOrdersView')?.classList.contains('hidden'))return;
    injectStyles();
    const orders=await fetchOrders(),pending=await fetchPending(orders);
    const active=orders.filter(o=>o.stage!=='Cancelada');
    const counts={ok:0,warn:0,late:0,done:0};active.forEach(o=>{const s=state(o);if(counts[s]!==undefined)counts[s]++});
    const totalLate=active.filter(o=>overallState(o)==='late').length;
    host.innerHTML=`${pending.length?`<div class="spc-sla-ready"><b>Propostas fechadas aguardando início da operação</b><div class="muted" style="font-size:12px">O SLA total de 15 dias começa no fechamento da proposta. A contagem deve ser enviada em até 1 dia.</div><div class="spc-sla-ready-grid">${pending.map(readyHtml).join('')}</div></div>`:''}<div class="spc-sla-summary"><div class="spc-sla-stat"><b>${counts.ok}</b><span>Em dia</span></div><div class="spc-sla-stat"><b>${counts.warn}</b><span>Atenção • vence em até 24h</span></div><div class="spc-sla-stat"><b>${counts.late}</b><span>Etapas atrasadas</span></div><div class="spc-sla-stat"><b>${totalLate}</b><span>SLA total de 15 dias vencido</span></div><div class="spc-sla-stat"><b>${counts.done}</b><span>Concluídas</span></div></div><div class="notice"><b>Controle de prazo:</b> proposta fechada → até 1 dia para enviar contagem → SPC até 7 dias → CDL até 1 dia para validar → SPC até 6 dias para entregar. Prazo máximo até o cliente: 15 dias corridos.</div><div class="spc-sla-board">${STAGES.map(s=>{const list=active.filter(o=>o.stage===s.key);return `<section class="spc-sla-col" data-drop-stage="${esc(s.key)}"><div class="spc-sla-head"><div><b>${esc(s.label)}</b><small>${esc(s.sla)}</small></div><span class="spc-sla-count">${list.length}</span></div><div class="spc-sla-stack">${list.length?list.map(cardHtml).join(''):'<div class="kanban-empty">Nenhum registro</div>'}</div></section>`}).join('')}</div>`;

    host.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>window.editSpcOrder?.(b.dataset.open)));
    host.querySelectorAll('select[data-stage]').forEach(sel=>sel.addEventListener('change',()=>moveStage(sel.dataset.stage,sel.value)));
    host.querySelectorAll('.spc-sla-card').forEach(card=>{
      card.addEventListener('dragstart',e=>{card.classList.add('dragging');e.dataTransfer.setData('text/plain',card.dataset.order)});
      card.addEventListener('dragend',()=>card.classList.remove('dragging'));
    });
    host.querySelectorAll('[data-drop-stage]').forEach(col=>{
      col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('dragover')});
      col.addEventListener('dragleave',()=>col.classList.remove('dragover'));
      col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('dragover');const id=e.dataTransfer.getData('text/plain');if(id)moveStage(id,col.dataset.dropStage)});
    });
  }

  async function moveStage(id,next){
    const {data:o,error}=await sb.from('spc_data_orders').select('*').eq('id',id).single();
    if(error||!o)return alert('Não foi possível carregar a Ordem SPC.');
    if(o.stage===next)return;
    if(next==='Aguardando planilha de dados'&&(o.count_result===null||o.count_result===undefined)){
      alert('Antes de validar a contagem, registre a quantidade retornada pelo SPC na ordem.');
      return window.editSpcOrder?.(id);
    }
    const {error:e}=await sb.from('spc_data_orders').update({stage:next}).eq('id',id);
    if(e){console.error(e);alert('Não foi possível mover a ordem. Se a migração 017 ainda não foi executada no Supabase, execute-a antes de usar a nova etapa.');return}
    await render();
  }
  window.renderSpcSlaKanban=render;
  window.moveSpcOrderStage=moveStage;

  async function enhanceDialog(id){
    const d=document.getElementById('spcOrderDialog');if(!d)return;
    const {data:o}=await sb.from('spc_data_orders').select('*').eq('id',id).maybeSingle();if(!o)return;
    const sel=document.getElementById('soStage');
    if(sel){
      const current=o.stage;
      sel.innerHTML=STAGES.map(x=>`<option value="${esc(x.key)}">${esc(x.label)}</option>`).join('')+'<option value="Cancelada">Cancelada</option>';
      sel.value=current;
    }
    d.querySelector('.spc-sla-dialog')?.remove();
    const due=stageDue(o),total=overallDue(o),st=state(o);
    const anchor=d.querySelector('.notice');
    if(anchor){anchor.insertAdjacentHTML('afterend',`<div class="spc-sla-dialog"><div class="eyebrow">Controle de SLA</div><div class="spc-sla-dialog-grid"><div><small>Situação atual</small><b>${esc(colorLabel(st))}${due?' • '+esc(remaining(due)):''}</b></div><div><small>Prazo da etapa</small><b>${esc(fmt(due))}</b></div><div><small>Prazo total ao cliente</small><b>${esc(fmt(total))}</b></div><div><small>SLA total</small><b>15 dias corridos</b></div></div></div>`)}
  }

  function install(){
    if(window.__spcSlaKanbanInstalled||typeof window.openSpcOrders!=='function'||typeof window.editSpcOrder!=='function')return false;
    window.__spcSlaKanbanInstalled=true;injectStyles();
    const open=window.openSpcOrders;
    window.openSpcOrders=async function(){const r=await open.apply(this,arguments);await render();return r};
    const edit=window.editSpcOrder;
    window.editSpcOrder=async function(id){const r=await edit.apply(this,arguments);await enhanceDialog(id);return r};
    if(typeof window.saveSpcOrder==='function'){
      const save=window.saveSpcOrder;
      window.saveSpcOrder=async function(id,silent=false){const r=await save.apply(this,arguments);if(r!==false&&!silent)setTimeout(render,100);return r};
    }
    setInterval(()=>{if(!document.getElementById('spcOrdersView')?.classList.contains('hidden'))render()},60000);
    return true;
  }
  if(!install()){let n=0;const t=setInterval(()=>{n++;if(install()||n>60)clearInterval(t)},150)}
})();