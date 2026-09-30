// Compatibilidade do botão "Iniciar Ordem SPC" + carregamento do módulo Ordens SPC.
(()=>{
  function addScript(src,key){
    const existing=document.querySelector(`script[data-orders-module="${key}"]`);
    if(existing?.dataset.loaded==='true')return Promise.resolve();
    if(existing)return new Promise((resolve,reject)=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true})});
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.dataset.ordersModule=key;s.addEventListener('load',()=>{s.dataset.loaded='true';resolve()},{once:true});s.addEventListener('error',()=>reject(new Error(`Falha ao carregar ${src}`)),{once:true});document.head.appendChild(s)});
  }
  async function loadOrdersModule(){
    await addScript('spc-orders.js?v=20260923-manual1','spcOrders');
    await addScript('spc-orders-data-sync.js?v=20260917-sync4','spcSync');
    await addScript('spc-orders-proposal-lock.js?v=20260917-regions-ticket1','spcLock');
    await addScript('spc-orders-filter-controls.js?v=20260917-regions-ticket1','spcFilters');
    await addScript('spc-orders-print-complete.js?v=20260917-regions-ticket1','spcPrint');
    await addScript('spc-orders-kanban-sla.js?v=20260923-lifecycle1','spcSla');
    await addScript('calculator-manual-improvements.js?v=20260929-house-holding1','calculatorManualImprovements');
    await addScript('spc-orders-lifecycle.js?v=20260930-excel-allocation3','spcOrdersLifecycle');
    await addScript('spc-orders-allocation.js?v=20260930-count-validation4','spcOrdersAllocation');
    await addScript('commercial-ownership.js?v=20260930-funnel-sync2','commercialOwnership');
  }
  const ordersReady=loadOrdersModule().catch(error=>{console.error('Falha ao carregar os módulos das Ordens SPC.',error);return false});
  window.generateProductionOrder=async function(proposalId){
    await ordersReady;
    const {data:existing,error}=await sb.from('spc_data_orders').select('id').eq('proposal_id',proposalId).eq('active',true).maybeSingle();
    if(error){console.error(error);alert('Não foi possível consultar a Ordem SPC.');return;}
    if(existing?.id&&typeof window.editSpcOrder==='function')return window.editSpcOrder(existing.id);
    if(typeof window.createSpcOrder==='function')return window.createSpcOrder(proposalId);
    alert('O módulo Ordens SPC ainda está carregando. Tente novamente em alguns segundos.');
  };
})();
