// Compatibilidade do botão antigo "Ordem SPC" + carregamento do novo módulo Ordens SPC.
(()=>{
  function loadOrdersModule(){
    if(document.querySelector('script[data-spc-orders]'))return;
    const s=document.createElement('script');
    s.src='spc-orders.js?v=20260917-1';
    s.dataset.spcOrders='1';
    document.head.appendChild(s);
  }
  loadOrdersModule();

  // O botão legado não gera mais uma ordem final diretamente: agora inicia/abre
  // a ordem editável, começando pela etapa de Contagem SPC Brasil.
  window.generateProductionOrder=async function(proposalId){
    if(typeof window.openSpcOrders!=='function'){
      loadOrdersModule();
      await new Promise(r=>setTimeout(r,450));
    }
    const {data:existing,error}=await sb.from('spc_data_orders').select('id').eq('proposal_id',proposalId).eq('active',true).maybeSingle();
    if(error){console.error(error);alert('Não foi possível consultar a Ordem SPC.');return;}
    if(existing?.id&&typeof window.editSpcOrder==='function')return window.editSpcOrder(existing.id);
    if(typeof window.createSpcOrder==='function')return window.createSpcOrder(proposalId);
    alert('O módulo Ordens SPC ainda está carregando. Tente novamente em alguns segundos.');
  };
})();