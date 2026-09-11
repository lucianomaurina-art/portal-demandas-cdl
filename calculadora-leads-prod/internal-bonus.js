// Bonificação comercial interna — visível apenas para admin e manager.
// Base: valor líquido da venda (já descontado), nunca o custo/margem.
(() => {
  const bonusRate=markup=>{
    const m=Math.round(Number(markup||0)*100);
    if(m>=100)return .10;
    if(m>=70)return .07;
    return .05;
  };
  const eligibleRole=role=>role==='admin'||role==='manager';
  function ensureBonusBox(){
    const panel=document.getElementById('internalPanel');
    if(!panel)return null;
    let box=document.getElementById('salesBonusBox');
    if(box)return box;
    box=document.createElement('div');
    box.id='salesBonusBox';
    box.className='hidden';
    box.style.cssText='margin-top:12px;padding-top:12px;border-top:1px solid #efd39a';
    panel.appendChild(box);
    return box;
  }
  async function renderSalesBonus(){
    const box=ensureBonusBox();if(!box)return;
    let role='';
    try{role=typeof portalLoadRole==='function'?await portalLoadRole():''}catch(_e){}
    if(!eligibleRole(role)||!internalOpen||!internalQuote||!quote){box.classList.add('hidden');box.innerHTML='';return}
    const rate=bonusRate(internalQuote.markup);
    const netSale=Number(quote.sale_total||0);
    const bonus=Number((netSale*rate).toFixed(2));
    box.innerHTML=`<div class="eyebrow">Bonificação comercial</div><div class="kv"><span>Base da bonificação</span><b>${money(netSale)}</b></div><div class="kv"><span>Percentual</span><b>${Math.round(rate*100)}%</b></div><div class="kv"><span>Bonificação estimada</span><b>${money(bonus)}</b></div><div class="muted" style="font-size:11px;line-height:1.4">Base: valor líquido da proposta após eventual desconto. Informação restrita aos perfis Gestor e Administrador.</div>`;
    box.classList.remove('hidden');
  }
  const originalLoadInternal=window.loadInternal;
  if(typeof originalLoadInternal==='function')window.loadInternal=async function(){const r=await originalLoadInternal.apply(this,arguments);await renderSalesBonus();return r};
  const originalRenderQuote=window.renderQuote;
  if(typeof originalRenderQuote==='function')window.renderQuote=function(){const r=originalRenderQuote.apply(this,arguments);if(internalOpen)setTimeout(renderSalesBonus,0);return r};
  window.renderSalesBonus=renderSalesBonus;
})();

// Propaga CNAEs/segmentos informados na solicitação pública para a gestão e proposta.
(() => {
  window.currentRequestCnaesSegments='';
  const originalClientData=window.clientData;
  if(typeof originalClientData==='function'){
    window.clientData=function(){
      const base=originalClientData();
      return {...base,cnaes_segments:window.currentRequestCnaesSegments||base?.cnaes_segments||''};
    };
  }
  const originalLoad=window.loadRequestFromKanban;
  if(typeof originalLoad==='function'){
    window.loadRequestFromKanban=async function(id){
      const {data:r}=await sb.from('lead_quote_requests').select('client').eq('id',id).maybeSingle();
      window.currentRequestCnaesSegments=r?.client?.cnaes_segments||'';
      return originalLoad(id);
    };
  }
  const originalView=window.viewRequest;
  if(typeof originalView==='function'){
    window.viewRequest=async function(id){
      const {data:r}=await sb.from('lead_quote_requests').select('client').eq('id',id).maybeSingle();
      const result=await originalView(id);
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
})();
