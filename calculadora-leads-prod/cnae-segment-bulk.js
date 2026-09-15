// Melhora a descoberta do comando de seleção em massa por segmento, sem alterar dados ou precificação.
(()=>{
  function activeSegments(root){
    return [...root.querySelectorAll('[data-seg]')].filter(b=>{
      const bg=(b.style.background||'').toLowerCase();
      const border=(b.style.borderColor||'').toLowerCase();
      return bg.includes('e8f1ff')||border.includes('0b62d6')||border.includes('rgb(11, 98, 214)');
    }).map(b=>b.dataset.seg).filter(Boolean);
  }
  function refresh(root=document){
    root.querySelectorAll('[data-toggle-all]').forEach(btn=>{
      const host=btn.closest('[id$="CnaeSelector"], #cnaeSharedHost')||btn.parentElement?.parentElement?.parentElement||document;
      const segs=activeSegments(host);
      const isUnmark=/^Desmarcar/i.test(btn.textContent.trim());
      if(segs.length===1) btn.textContent=`${isUnmark?'Desmarcar':'Marcar'} todos os CNAEs de ${segs[0]}`;
      else if(segs.length>1) btn.textContent=`${isUnmark?'Desmarcar':'Marcar'} todos os CNAEs dos segmentos selecionados`;
      else btn.textContent=`${isUnmark?'Desmarcar':'Marcar'} todos os CNAEs exibidos`;
      btn.title='Aplica a ação a todos os CNAEs específicos exibidos neste segmento/filtro.';
    });
  }
  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})};
  document.addEventListener('click',e=>{if(e.target.closest('[data-seg],[data-toggle-all],[data-root-all],[data-cnae],[data-remove],[data-clear-all]'))setTimeout(schedule,0)},true);
  document.addEventListener('input',e=>{if(e.target.matches('[data-search]'))setTimeout(schedule,150)},true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule();
})();