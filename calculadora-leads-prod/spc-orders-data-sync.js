// Sincronização defensiva: toda Ordem SPC herda a proposta completa e, quando houver, a solicitação de origem.
(()=>{
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  const uniq=a=>{const out=[];(a||[]).filter(Boolean).forEach(x=>{if(!out.some(y=>norm(y)===norm(x)))out.push(x)});return out};
  function comboItems(p){
    if(p?.mode!=='combo')return [];
    const level=p.selection?.level,person=p.person;
    const combo=(window.LEAD_CATALOG?.combos||[]).find(x=>x.person===person&&norm(x.level)===norm(level));
    return [...(combo?.items||[]),...(p.selection?.addons||[])];
  }
  function proposalFields(p){
    if(p?.mode==='combo')return uniq(comboItems(p));
    const out=[];
    const add=x=>{if(x&&!out.some(y=>norm(y)===norm(x)))out.push(x)};
    (p?.quote?.items||[]).forEach(i=>{
      if(Array.isArray(i.details)&&i.details.length)i.details.forEach(add);
      else add(i.name);
    });
    if(Array.isArray(p?.selection))p.selection.forEach(x=>add(x.flag||x.name||x));
    return out;
  }
  async function findRequest(p){
    const c=p?.client||{};
    if(c.source_request_id){const {data}=await sb.from('lead_quote_requests').select('*').eq('id',c.source_request_id).maybeSingle();if(data)return data}
    const {data}=await sb.from('lead_quote_requests').select('*').order('created_at',{ascending:false}).limit(300);
    const doc=norm(c.doc),email=String(c.email||'').trim().toLowerCase(),company=norm(c.company);
    return (data||[]).find(r=>{const x=r.client||{};return (doc&&norm(x.doc)===doc)||(email&&String(x.email||'').trim().toLowerCase()===email)||(company&&norm(x.company)===company)})||null;
  }
  async function sync(orderId){
    const {data:o}=await sb.from('spc_data_orders').select('*').eq('id',orderId).maybeSingle();if(!o)return;
    const {data:p}=await sb.from('lead_proposals').select('*').eq('id',o.proposal_id).maybeSingle();if(!p)return;
    const r=await findRequest(p),pc=p.client||{},rc=r?.client||{};
    const client={...rc,...pc,...(o.client||{}),proposal_code:p.code,quantity:p.quantity||p.quote?.quantity||o.client?.quantity,mode:p.mode,combo_level:p.selection?.level||'',combo_addons:p.selection?.addons||[]};
    const target=pc.cnae_target||rc.cnae_target||o.targeting||{};
    const external=o.external_notes||pc.client_notes||r?.notes||rc.client_notes||'';
    const internal=o.internal_notes||pc.internal_notes||rc.internal_notes||'';
    const proposalNotes=pc.proposal_notes||rc.proposal_notes||o.filters?.proposal_notes||'';
    const existing=pc.existing_data||rc.existing_data||o.filters?.existing_data||'';
    const focus=pc.focus||rc.focus||o.filters?.region||'';
    // Regra contratual: a Ordem SPC não acumula atributos antigos nem opções operacionais.
    // requested_fields é sempre refeito exclusivamente a partir da proposta fechada.
    const requested=proposalFields(p);
    const filters={...(o.filters||{}),region:focus||o.filters?.region||'',client_notes:external,proposal_notes:proposalNotes,existing_data:existing,legacy_cnae:pc.cnaes_segments||pc.cnae_segments||rc.cnaes_segments||rc.cnae_segments||o.filters?.legacy_cnae||''};
    await sb.from('spc_data_orders').update({client,targeting:target,requested_fields:requested,filters,external_notes:external,internal_notes:internal}).eq('id',orderId);
  }
  function install(){
    if(window.__spcSyncInstalled||typeof window.editSpcOrder!=='function'||typeof window.createSpcOrder!=='function')return false;
    window.__spcSyncInstalled=true;
    const edit=window.editSpcOrder;
    window.editSpcOrder=async id=>{await sync(id);return edit(id)};
    const create=window.createSpcOrder;
    window.createSpcOrder=async proposalId=>{
      await create(proposalId);
      const {data:o}=await sb.from('spc_data_orders').select('id').eq('proposal_id',proposalId).eq('active',true).maybeSingle();
      if(o?.id){await sync(o.id);document.getElementById('spcOrderDialog')?.close();return edit(o.id)}
    };
    return true;
  }
  if(!install()){let n=0;const t=setInterval(()=>{n++;if(install()||n>40)clearInterval(t)},150)}
})();