// Campos de informações da proposta diretamente na calculadora.
// Observação do cliente + informações adicionais ficam visíveis e acompanham a proposta.
(() => {
  function ensureFields(){
    if(document.getElementById('calculatorClientNotes')) return;
    const form=document.querySelector('#calculatorView .formgrid');
    if(!form) return;
    const box=document.createElement('div');
    box.id='calculatorProposalInfo';
    box.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:4px';
    box.innerHTML=`
      <div><label>Observações do cliente</label><textarea id="calculatorClientNotes" rows="4" placeholder="Registre aqui as observações, necessidades ou orientações informadas pelo cliente."></textarea><div class="muted" style="font-size:11px;margin-top:5px">Visível na proposta comercial.</div></div>
      <div><label>Informações adicionais para a proposta</label><textarea id="calculatorProposalNotes" rows="4" placeholder="Inclua informações complementares que devem constar na proposta."></textarea><div class="muted" style="font-size:11px;margin-top:5px">Visível na proposta comercial.</div></div>`;
    form.appendChild(box);
    const style=document.createElement('style');
    style.textContent='@media(max-width:700px){#calculatorProposalInfo{grid-template-columns:1fr!important}}';
    document.head.appendChild(style);
  }

  ensureFields();

  const originalClientData=window.clientData;
  window.clientData=function(){
    const c=originalClientData();
    c.client_notes=document.getElementById('calculatorClientNotes')?.value.trim()||'';
    c.proposal_notes=document.getElementById('calculatorProposalNotes')?.value.trim()||'';
    return c;
  };

  const originalLoadRequest=window.loadRequest;
  window.loadRequest=async function(id){
    await originalLoadRequest(id);
    try{
      const {data:r}=await sb.from('lead_quote_requests').select('notes,client').eq('id',id).single();
      if(!r)return;
      const c=r.client||{};
      const n=document.getElementById('calculatorClientNotes'),p=document.getElementById('calculatorProposalNotes');
      if(n)n.value=r.notes||c.client_notes||'';
      if(p)p.value=c.proposal_notes||'';
    }catch(e){console.error('Não foi possível carregar as informações da proposta.',e)}
  };

  // O Kanban usa este nome em alguns fluxos.
  const originalKanban=window.loadRequestFromKanban;
  if(typeof originalKanban==='function'){
    window.loadRequestFromKanban=async function(id){
      await originalKanban(id);
      try{
        const {data:r}=await sb.from('lead_quote_requests').select('notes,client').eq('id',id).single();
        if(!r)return;
        const c=r.client||{};
        const n=document.getElementById('calculatorClientNotes'),p=document.getElementById('calculatorProposalNotes');
        if(n)n.value=r.notes||c.client_notes||'';
        if(p)p.value=c.proposal_notes||'';
      }catch(e){console.error(e)}
    };
  }
})();