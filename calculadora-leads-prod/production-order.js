// Compatibilidade do botão "Iniciar Ordem SPC" + carregamento do módulo Ordens SPC.
(()=>{
  function addScript(src,key){
    if(document.querySelector(`script[data-${key}]`))return;
    const s=document.createElement('script');
    s.src=src;
    s.dataset[key]='1';
    document.head.appendChild(s);
  }
  function loadOrdersModule(){
    addScript('spc-orders.js?v=20260917-flow3','spcOrders');
    addScript('spc-orders-data-sync.js?v=20260917-sync1','spcSync');
    addScript('spc-orders-proposal-lock.js?v=20260917-lock1','spcLock');
  }
  loadOrdersModule();
  window.generateProductionOrder=async function(proposalId){
    if(typeof window.openSpcOrders!=='function'){
      loadOrdersModule();
      await new Promise(r=>setTimeout(r,500));
    }
    const {data:existing,error}=await sb.from('spc_data_orders').select('id').eq('proposal_id',proposalId).eq('active',true).maybeSingle();
    if(error){console.error(error);alert('Não foi possível consultar a Ordem SPC.');return;}
    if(existing?.id&&typeof window.editSpcOrder==='function')return window.editSpcOrder(existing.id);
    if(typeof window.createSpcOrder==='function')return window.createSpcOrder(proposalId);
    alert('O módulo Ordens SPC ainda está carregando. Tente novamente em alguns segundos.');
  };
})();