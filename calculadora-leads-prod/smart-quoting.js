// Recomendação inteligente de combos + desconto comercial opcional
let commercialDiscountPercent=0;
let grossQuote=null;

const normLeadName=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
  .replace(/^nome$/,'nome completo').replace(/^endereco$/,'endereco completo').replace(/^data de abertura$/,'data de fundacao')
  .replace(/^restricao spc$/,'restricao 1 bureau').replace(/^restricao spc e serasa$/,'restricao 2 bureaux')
  .replace(/^quadro social administrativo$/,'quadro social e administrativo');

function ensureDiscountUI(){
  const actions=document.querySelector('#calculatorView .summary .actions');
  if(!actions||document.getElementById('discountBox'))return;
  const box=document.createElement('div');box.id='discountBox';box.className='internal-box';box.style.cssText='margin-top:14px;background:#f8fbff;border-color:#cfe0f6';
  box.innerHTML=`<div class="eyebrow">Condição comercial</div><label style="margin:8px 0 6px">Desconto na proposta (%)</label><input id="proposalDiscount" type="number" min="0" max="100" step="0.1" value="0" style="width:100%"><div id="discountInfo" class="muted" style="font-size:12px;margin-top:7px">Opcional. Deixe 0 para manter o valor calculado.</div>`;
  actions.parentNode.insertBefore(box,actions);
  document.getElementById('proposalDiscount').addEventListener('input',e=>{commercialDiscountPercent=Math.min(100,Math.max(0,Number(e.target.value)||0));applyCommercialDiscount()});
}

const baseRenderQuote=window.renderQuote;
window.renderQuote=function(x){
  ensureDiscountUI();
  if(x && !x._discount_applied){grossQuote=JSON.parse(JSON.stringify(x));applyCommercialDiscount(false);return}
  return baseRenderQuote(x);
};

function applyCommercialDiscount(render=true){
  if(!grossQuote){if(render)baseRenderQuote(quote);return}
  const pct=commercialDiscountPercent/100;
  const q=JSON.parse(JSON.stringify(grossQuote));
  q.gross_sale_total=Number(grossQuote.sale_total||0);
  q.gross_sale_unit=Number(grossQuote.sale_unit||0);
  q.discount_percent=commercialDiscountPercent;
  q.discount_amount=Number((q.gross_sale_total*pct).toFixed(2));
  q.sale_total=Number((q.gross_sale_total*(1-pct)).toFixed(2));
  q.sale_unit=Number((q.gross_sale_unit*(1-pct)).toFixed(4));
  q.items=(grossQuote.items||[]).map(i=>({...i,commercial_unit:Number((Number(i.commercial_unit||0)*(1-pct)).toFixed(4))}));
  q._discount_applied=true;
  quote=q;
  baseRenderQuote(q);
  const info=document.getElementById('discountInfo');
  if(info)info.innerHTML=commercialDiscountPercent>0?`Valor original: <b>${money(q.gross_sale_total)}</b> • Desconto: <b>${commercialDiscountPercent.toLocaleString('pt-BR')}%</b> (${money(q.discount_amount)})`:'Opcional. Deixe 0 para manter o valor calculado.';
}

function resetCommercialDiscount(){commercialDiscountPercent=0;grossQuote=null;const el=document.getElementById('proposalDiscount');if(el)el.value='0';const info=document.getElementById('discountInfo');if(info)info.textContent='Opcional. Deixe 0 para manter o valor calculado.'}

async function recommendComboForRequest(r){
  if(r.mode!=='individual'||!Array.isArray(r.selection)||!r.selection.length)return null;
  const person=r.person,requested=[...new Set(r.selection.map(x=>normLeadName(x.flag)).filter(Boolean))];
  const combos=(C.combos||[]).filter(x=>x.person===person),addons=(C.addons||[]).filter(x=>x.person===person);
  const addonByNorm=new Map(addons.map(a=>[normLeadName(a.name),a.name]));
  const candidates=[];
  for(const combo of combos){
    const included=new Set((combo.items||[]).map(normLeadName));
    const missing=requested.filter(flag=>!included.has(flag));
    if(missing.some(flag=>!addonByNorm.has(flag)))continue;
    const neededAdds=[...new Set(missing.map(flag=>addonByNorm.get(flag)))];
    const {data,error}=await sb.rpc('calculate_lead_quote',{p_mode:'combo',p_person:person,p_qty:r.quantity,p_selection:{level:combo.level,addons:neededAdds}});
    if(!error&&data)candidates.push({combo,addons:neededAdds,quote:data,covered:requested.length-missing.length});
  }
  if(!candidates.length)return null;
  candidates.sort((a,b)=>Number(a.quote.sale_total)-Number(b.quote.sale_total)||b.covered-a.covered||a.addons.length-b.addons.length);
  return candidates[0];
}

const originalLoadRequestFromKanban=window.loadRequestFromKanban;
window.loadRequestFromKanban=async function(id){
  const {data:r,error}=await sb.from('lead_quote_requests').select('*').eq('id',id).single();
  if(error||!r){alert('Não foi possível carregar esta solicitação na calculadora.');return}
  const recommendation=await recommendComboForRequest(r);
  resetCommercialDiscount();
  if(!recommendation)return originalLoadRequestFromKanban(id);
  currentRequestId=r.id;mode='combo';
  document.getElementById('person').value=r.person;document.getElementById('qty').value=r.quantity;
  const c=r.client||{};document.getElementById('client').value=c.company||'';document.getElementById('doc').value=c.doc||'';document.getElementById('contact').value=c.contact||'';document.getElementById('clientEmail').value=c.email||'';document.getElementById('phone').value=c.phone||'';document.getElementById('focus').value=c.focus||'';
  selected.clear();selectedAdds.clear();activeProducts=[];selectedCombo=recommendation.combo.level;recommendation.addons.forEach(a=>selectedAdds.add(a));
  document.getElementById('individualArea').classList.add('hidden');document.getElementById('comboArea').classList.remove('hidden');document.getElementById('tabInd').classList.remove('active');document.getElementById('tabCombo').classList.add('active');
  const {data:{user}}=await sb.auth.getUser();await sb.from('lead_quote_requests').update({handled_by:user?.id||null,updated_at:new Date().toISOString()}).eq('id',id);
  openSection('calculator');render();window.scrollTo({top:0,behavior:'smooth'});
  const extras=recommendation.addons.length?`\nComplementos avulsos sugeridos: ${recommendation.addons.join(', ')}.`:'\nO combo já contempla todos os dados solicitados.';
  alert(`Sugestão inteligente para ${r.code}: Combo ${recommendation.combo.level}.${extras}\n\nA calculadora foi preparada automaticamente com essa composição. Você pode ajustá-la antes de gerar a proposta.`);
};

ensureDiscountUI();
