// Público-alvo operacional na calculadora. Não altera selection() nem RPCs de preço.
(() => {
  let selector=null,currentTarget=null;
  function loadBulkHelper(){if(document.querySelector('script[data-cnae-segment-bulk]'))return;const s=document.createElement('script');s.src='./cnae-segment-bulk.js?v=20260915-cnae5';s.dataset.cnaeSegmentBulk='1';document.head.appendChild(s)}
  function ensure(){
    if(document.getElementById('calculatorCnaeTarget'))return;
    const person=document.getElementById('person');if(!person)return;
    const grid=person.closest('.formgrid');if(!grid)return;
    const wrap=document.createElement('div');wrap.id='calculatorCnaeTarget';wrap.className='hidden';wrap.style.gridColumn='1 / -1';wrap.innerHTML='<div id="calculatorCnaeSelector"></div>';
    grid.insertAdjacentElement('afterend',wrap);
    selector=window.CDLCnaeSelector?.mount(document.getElementById('calculatorCnaeSelector'))||null;loadBulkHelper();
  }
  function sync(){ensure();const pj=document.getElementById('person')?.value==='Pessoa Jurídica';document.getElementById('calculatorCnaeTarget')?.classList.toggle('hidden',!pj)}
  function getTarget(){return document.getElementById('person')?.value==='Pessoa Jurídica'?(selector?.getValue()||currentTarget||null):null}
  function setTarget(v){currentTarget=v||null;selector?.setValue(v||{})}
  const originalReset=window.resetSelection;if(typeof originalReset==='function')window.resetSelection=function(){const saved=getTarget();const r=originalReset.apply(this,arguments);sync();if(document.getElementById('person')?.value==='Pessoa Jurídica'&&saved?.cnaes?.length)setTarget(saved);return r};
  const originalClientData=window.clientData;if(typeof originalClientData==='function')window.clientData=function(){const base=originalClientData();const target=getTarget();return {...base,cnae_target:target,cnaes_segments:target?(target.cnaes?.map(x=>`${x.code} — ${x.description}`).join('\n')||target.free_text||''):(base.cnaes_segments||'')}};
  const originalLoad=window.loadRequestFromKanban;if(typeof originalLoad==='function')window.loadRequestFromKanban=async function(id){const {data:r}=await sb.from('lead_quote_requests').select('client').eq('id',id).maybeSingle();setTarget(r?.client?.cnae_target||null);const out=await originalLoad(id);sync();setTarget(r?.client?.cnae_target||null);return out};
  window.getCalculatorCnaeTarget=getTarget;window.setCalculatorCnaeTarget=setTarget;
  ensure();sync();
})();