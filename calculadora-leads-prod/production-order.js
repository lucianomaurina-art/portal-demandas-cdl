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
    addScript('spc-orders.js?v=20260923-manual1','spcOrders');
    addScript('spc-orders-data-sync.js?v=20260917-sync4','spcSync');
    addScript('spc-orders-proposal-lock.js?v=20260917-regions-ticket1','spcLock');
    addScript('spc-orders-filter-controls.js?v=20260917-regions-ticket1','spcFilters');
    addScript('spc-orders-print-complete.js?v=20260917-regions-ticket1','spcPrint');
    addScript('spc-orders-kanban-sla.js?v=20260923-lifecycle1','spcSla');
    addScript('calculator-manual-improvements.js?v=20260923-1','calculatorManualImprovements');
    addScript('spc-orders-lifecycle.js?v=20260923-1','spcOrdersLifecycle');
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
