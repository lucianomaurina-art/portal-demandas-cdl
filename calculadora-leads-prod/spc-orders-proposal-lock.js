// Ordem SPC: atributos são contratuais e vêm exclusivamente da proposta fechada.
(()=>{
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  function proposalFields(p){
    const out=[], add=x=>{if(x&&!out.some(y=>norm(y)===norm(x)))out.push(x)};
    if(p?.mode==='combo'){
      const combo=(window.LEAD_CATALOG?.combos||[]).find(c=>c.person===p.person&&norm(c.level)===norm(p.selection?.level));
      (combo?.items||[]).forEach(add);
      (p.selection?.addons||[]).forEach(add);
    }else{
      (p?.quote?.items||[]).forEach(i=>{
        if(Array.isArray(i.details)&&i.details.length)i.details.forEach(add);
        else if(i.name)add(i.name);
      });
      if(Array.isArray(p?.selection))p.selection.forEach(x=>add(x.flag||x.name||x));
    }
    return out;
  }
  function lockDialog(p){
    const exact=proposalFields(p);
    const boxes=[...document.querySelectorAll('#spcOrderDialog input[name="spcField"]')];
    boxes.forEach(cb=>{
      const yes=exact.some(x=>{const a=norm(x),b=norm(cb.value);return a===b||a.includes(b)||b.includes(a)||(a==='NOME'&&b==='NOME COMPLETO')||(a==='ENDERECO'&&b==='ENDERECO COMPLETO')||(a==='DATA DE ABERTURA'&&b==='DATA DE ABERTURA')||(a.includes('QUADRO SOCIAL')&&b==='QSA')||(a==='CNAE'&&b.includes('ATIVIDADE ECONOMICA'))});
      cb.checked=yes;
      cb.disabled=true;
      cb.style.cursor='not-allowed';
      cb.closest('label')?.style.setProperty('background',yes?'#f4f8ff':'#f8fafc');
      cb.closest('label')?.style.setProperty('opacity',yes?'1':'.45');
    });
    const heading=[...document.querySelectorAll('#spcOrderDialog h3')].find(x=>x.textContent.includes('Atributos que o SPC deve retornar'));
    if(heading){
      const ptxt=heading.nextElementSibling;
      if(ptxt?.classList.contains('muted'))ptxt.textContent='Atributos definidos na proposta fechada. Esta composição é contratual e não pode ser alterada na Ordem SPC.';
    }
    // Campo técnico oculto garante que salvar a ordem preserve exatamente o contratado,
    // inclusive quando um atributo não tiver equivalente visual no formulário do SPC.
    let hidden=document.getElementById('soProposalLockedFields');
    if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.id='soProposalLockedFields';document.getElementById('spcOrderDialog')?.appendChild(hidden)}
    hidden.value=JSON.stringify(exact);
  }
  function patch(){
    if(typeof window.editSpcOrder!=='function'||window.editSpcOrder.__proposalLocked)return false;
    const originalEdit=window.editSpcOrder;
    window.editSpcOrder=async function(id){
      const r=await originalEdit.apply(this,arguments);
      const dlg=document.getElementById('spcOrderDialog');
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
      // O módulo-base lê checkboxes habilitados/checados. Habilitamos apenas durante a coleta,
      // e depois gravamos a lista integral da proposta para eliminar qualquer divergência.
      document.querySelectorAll('#spcOrderDialog input[name="spcField"]').forEach(x=>x.disabled=false);
      const ok=await originalSave.apply(this,arguments);
      if(ok!==false){await sb.from('spc_data_orders').update({requested_fields:exact}).eq('id',id)}
      document.querySelectorAll('#spcOrderDialog input[name="spcField"]').forEach(x=>x.disabled=true);
      return ok;
    };
    return true;
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(patch()||tries>30)clearInterval(timer)},150);
})();