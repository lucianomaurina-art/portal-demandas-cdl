// Ordem SPC: atributos são contratuais e vêm exclusivamente da proposta fechada.
(()=>{
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function proposalEntries(p){
    const out=[],add=(name,source)=>{if(name&&!out.some(x=>norm(x.name)===norm(name)))out.push({name,source})};
    if(p?.mode==='combo'){
      const level=p.selection?.level||'';
      const combo=(window.LEAD_CATALOG?.combos||[]).find(c=>c.person===p.person&&norm(c.level)===norm(level));
      (combo?.items||[]).forEach(x=>add(x,`Combo ${level}`));
      (p.selection?.addons||[]).forEach(x=>add(x,'Adicional contratado'));
    }else{
      (p?.quote?.items||[]).forEach(i=>{
        if(Array.isArray(i.details)&&i.details.length)i.details.forEach(x=>add(x,'Contratado na proposta'));
        else if(i.name)add(i.name,'Contratado na proposta');
      });
      if(Array.isArray(p?.selection))p.selection.forEach(x=>add(x.flag||x.name||x,'Contratado na proposta'));
    }
    return out;
  }
  function lockDialog(p){
    const entries=proposalEntries(p),exact=entries.map(x=>x.name);
    const heading=[...document.querySelectorAll('#spcOrderDialog h3')].find(x=>x.textContent.includes('Atributos que o SPC deve retornar'));
    if(!heading)return;
    const note=heading.nextElementSibling;
    if(note?.classList.contains('muted'))note.textContent='Atributos definidos na proposta fechada. Esta composição é contratual e não pode ser alterada na Ordem SPC.';
    const list=note?.nextElementSibling;
    if(list?.classList.contains('items')){
      list.innerHTML=entries.length?entries.map(x=>`<div style="border:1px solid #bfd4ee;background:#f4f8ff;border-radius:11px;padding:11px 13px;display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b style="font-size:13px">✓ ${esc(x.name)}</b></div><span class="muted" style="font-size:11px;white-space:nowrap">${esc(x.source)}</span></div>`).join(''):'<div class="muted">Nenhum atributo contratado encontrado na proposta.</div>';
      // Mantém os campos contratuais no formulário apenas para o salvamento técnico,
      // sem oferecer controles editáveis ao usuário.
      exact.forEach((name,i)=>list.insertAdjacentHTML('beforeend',`<input type="checkbox" name="spcField" value="${esc(name)}" checked style="display:none" aria-hidden="true" tabindex="-1">`));
    }
    let hidden=document.getElementById('soProposalLockedFields');
    if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.id='soProposalLockedFields';document.getElementById('spcOrderDialog')?.appendChild(hidden)}
    hidden.value=JSON.stringify(exact);
  }
  function patch(){
    if(typeof window.editSpcOrder!=='function'||window.editSpcOrder.__proposalLocked)return false;
    const originalEdit=window.editSpcOrder;
    window.editSpcOrder=async function(id){
      const r=await originalEdit.apply(this,arguments);
      const proposalId=(await sb.from('spc_data_orders').select('proposal_id').eq('id',id).single()).data?.proposal_id;
      if(proposalId){const {data:p}=await sb.from('lead_proposals').select('*').eq('id',proposalId).single();if(p)lockDialog(p)}
      return r;
    };
    window.editSpcOrder.__proposalLocked=true;
    const originalSave=window.saveSpcOrder;
    window.saveSpcOrder=async function(id,silent=false){
      const locked=document.getElementById('soProposalLockedFields');
      if(!locked)return originalSave.apply(this,arguments);
      const exact=JSON.parse(locked.value||'[]');
      const ok=await originalSave.apply(this,arguments);
      if(ok!==false){await sb.from('spc_data_orders').update({requested_fields:exact}).eq('id',id)}
      return ok;
    };
    return true;
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(patch()||tries>30)clearInterval(timer)},150);

  // Carrega o gerador completo mesmo quando production-order.js estiver em cache no navegador.
  if(!document.querySelector('script[data-spc-print-complete]')){
    const s=document.createElement('script');
    s.src='spc-orders-print-complete.js?v=20260917-print2';
    s.dataset.spcPrintComplete='1';
    document.head.appendChild(s);
  }
})();