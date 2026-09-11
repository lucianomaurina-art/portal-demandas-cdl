// Contexto adicional da solicitação pública: CNAEs/segmentos desejados.
window.currentRequestCnaesSegments='';

const _clientDataWithRequestContext=window.clientData;
if(typeof _clientDataWithRequestContext==='function'){
  window.clientData=function(){
    const base=_clientDataWithRequestContext();
    return {...base,cnaes_segments:window.currentRequestCnaesSegments||base?.cnaes_segments||''};
  };
}

const _loadRequestWithContext=window.loadRequestFromKanban;
if(typeof _loadRequestWithContext==='function'){
  window.loadRequestFromKanban=async function(id){
    const {data:r}=await sb.from('lead_quote_requests').select('client').eq('id',id).maybeSingle();
    window.currentRequestCnaesSegments=r?.client?.cnaes_segments||'';
    return _loadRequestWithContext(id);
  };
}

const _viewRequestWithContext=window.viewRequest;
if(typeof _viewRequestWithContext==='function'){
  window.viewRequest=async function(id){
    const {data:r}=await sb.from('lead_quote_requests').select('client').eq('id',id).maybeSingle();
    const result=await _viewRequestWithContext(id);
    const value=r?.client?.cnaes_segments||'';
    const d=document.getElementById('requestDetailDialog');
    if(value&&d&&!d.querySelector('[data-cnae-context]')){
      const actions=d.querySelector('.card-actions');
      const box=document.createElement('div');
      box.dataset.cnaeContext='1';
      box.style.cssText='margin-top:20px;padding:14px;background:#eef6ff;border-left:4px solid #0b62d6;border-radius:12px';
      const safe=String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      box.innerHTML=`<b>CNAEs ou segmentos desejados</b><div style="margin-top:6px;white-space:pre-wrap">${safe}</div>`;
      if(actions)actions.parentNode.insertBefore(box,actions);else d.firstElementChild?.appendChild(box);
    }
    return result;
  };
}
