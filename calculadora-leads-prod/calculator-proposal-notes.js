// Informações comerciais diretamente na calculadora.
// Mantém observações do cliente e informações adicionais disponíveis em uma única tela.
(() => {
  function ensureFields(){
    if(document.getElementById('calculatorClientNotes'))return;
    const form=document.querySelector('#calculatorView .formgrid');
    if(!form)return;
    const box=document.createElement('div');
    box.id='calculatorProposalInfo';
    box.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:4px';
    box.innerHTML=`<div><label>Observações do cliente</label><textarea id="calculatorClientNotes" rows="4" placeholder="Registre aqui as observações, necessidades ou orientações informadas pelo cliente."></textarea><div class="muted" style="font-size:11px;margin-top:5px">Visível na proposta comercial.</div></div><div><label>Informações adicionais para a proposta</label><textarea id="calculatorProposalNotes" rows="4" placeholder="Inclua informações complementares que devem constar na proposta."></textarea><div class="muted" style="font-size:11px;margin-top:5px">Visível na proposta comercial.</div></div>`;
    form.appendChild(box);
    const style=document.createElement('style');style.textContent='@media(max-width:700px){#calculatorProposalInfo{grid-template-columns:1fr!important}}';document.head.appendChild(style);
  }
  ensureFields();

  const originalClientData=window.clientData;
  window.clientData=function(){const c=originalClientData();c.client_notes=document.getElementById('calculatorClientNotes')?.value.trim()||'';c.proposal_notes=document.getElementById('calculatorProposalNotes')?.value.trim()||'';return c};

  async function fillRequestNotes(id){
    try{const {data:r}=await sb.from('lead_quote_requests').select('notes,client').eq('id',id).single();if(!r)return;const c=r.client||{},n=document.getElementById('calculatorClientNotes'),p=document.getElementById('calculatorProposalNotes');if(n)n.value=r.notes||c.client_notes||'';if(p)p.value=c.proposal_notes||''}catch(e){console.error('Não foi possível carregar as informações da proposta.',e)}
  }

  const originalLoadRequest=window.loadRequest;
  window.loadRequest=async function(id){await originalLoadRequest(id);await fillRequestNotes(id)};

  // O Kanban pode carregar a solicitação por uma função própria.
  const originalKanban=window.loadRequestFromKanban;
  if(typeof originalKanban==='function')window.loadRequestFromKanban=async function(id){await originalKanban(id);await fillRequestNotes(id)};

  async function syncCurrentRequest(){
    if(!currentRequestId)return;
    const notes=document.getElementById('calculatorClientNotes')?.value.trim()||'';
    const proposalNotes=document.getElementById('calculatorProposalNotes')?.value.trim()||'';
    const {data:r,error}=await sb.from('lead_quote_requests').select('client').eq('id',currentRequestId).single();if(error)throw error;
    const client={...(r?.client||{}),proposal_notes:proposalNotes};
    const {error:updateError}=await sb.from('lead_quote_requests').update({notes,client,updated_at:new Date().toISOString()}).eq('id',currentRequestId);if(updateError)throw updateError;
  }

  // proposal-layout.js já gera a proposta institucional. Este wrapper apenas garante
  // que os campos da calculadora cheguem a ela, inclusive quando a proposta nasce sem solicitação pública.
  const originalGenerateProposal=window.generateProposal;
  if(typeof originalGenerateProposal==='function')window.generateProposal=async function(){
    try{await syncCurrentRequest()}catch(e){console.error(e);alert('Não foi possível atualizar as informações da solicitação. Tente novamente.');return}
    const clientNotes=document.getElementById('calculatorClientNotes')?.value.trim()||'';
    const proposalNotes=document.getElementById('calculatorProposalNotes')?.value.trim()||'';
    let proposalWindow=null;const nativeOpen=window.open;
    window.open=function(...args){proposalWindow=nativeOpen.apply(window,args);return proposalWindow};
    try{await originalGenerateProposal()}finally{window.open=nativeOpen}
    // Quando a proposta foi criada diretamente na calculadora, não existe solicitação para o layout consultar.
    // Inserimos então os mesmos blocos visíveis diretamente no documento recém-gerado.
    if(!currentRequestId&&proposalWindow&&!proposalWindow.closed&&(clientNotes||proposalNotes)){
      const doc=proposalWindow.document,anchor=[...doc.querySelectorAll('.section-title')].find(x=>x.textContent.includes('Composição detalhada'));
      if(anchor){
        const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const holder=doc.createElement('div');holder.innerHTML=`${clientNotes?`<h2 class="section-title">Observações da solicitação</h2><div class="notes-box">${esc(clientNotes)}</div>`:''}${proposalNotes?`<h2 class="section-title">Informações adicionais da proposta</h2><div class="proposal-notes-box">${esc(proposalNotes)}</div>`:''}`;
        while(holder.firstChild)anchor.parentNode.insertBefore(holder.firstChild,anchor);
      }
    }
  };
})();