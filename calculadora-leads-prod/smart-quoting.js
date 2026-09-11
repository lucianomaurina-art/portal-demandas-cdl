// Recomendação inteligente de combos + desconto comercial opcional
let commercialDiscountPercent=0;
let grossQuote=null;
let currentSmartRecommendation=null;

const normLeadName=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
  .replace(/\s+1$/,'')
  .replace(/^nome$/,'nome completo').replace(/^endereco$/,'endereco completo').replace(/^data de abertura$/,'data de fundacao')
  .replace(/^restricao spc$/,'restricao 1 bureau').replace(/^restricao spc e serasa$/,'restricao 2 bureaux')
  .replace(/^quadro social administrativo$/,'quadro social e administrativo');

function ensureSmartStyles(){
  if(document.getElementById('smartQuoteStyles'))return;
  const s=document.createElement('style');s.id='smartQuoteStyles';s.textContent=`
  .smart-rec{border:1px solid #b9d5fb;background:#f6faff;border-radius:16px;padding:18px;margin:0 0 18px;box-shadow:0 5px 18px rgba(11,98,214,.06)}
  .smart-rec-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.smart-rec h3{margin:4px 0 4px;color:#071b33}.smart-chip{display:inline-flex;align-items:center;border-radius:999px;background:#e8f1ff;color:#084fae;font-size:11px;font-weight:900;padding:6px 9px;margin:4px 5px 0 0}.smart-chip.ok{background:#e7f6ef;color:#176b4d}.smart-chip.warn{background:#fff4df;color:#8a5a00}.smart-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.smart-box{background:#fff;border:1px solid #dce3ed;border-radius:12px;padding:12px;font-size:12px;line-height:1.45}.smart-box b{display:block;color:#071b33;margin-bottom:5px}.smart-list{margin:5px 0 0;padding-left:18px}.smart-note{font-size:12px;color:#667085;margin-top:12px;line-height:1.45}.smart-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}@media(max-width:760px){.smart-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
}

function ensureRecommendationUI(){
  ensureSmartStyles();
  let box=document.getElementById('smartRecommendation');
  if(box)return box;
  const panel=document.querySelector('#calculatorView .grid2 > .panel');
  if(!panel)return null;
  box=document.createElement('div');box.id='smartRecommendation';box.className='smart-rec hidden';
  panel.insertBefore(box,panel.firstChild);
  return box;
}

function clearRecommendation(){currentSmartRecommendation=null;const box=document.getElementById('smartRecommendation');if(box){box.classList.add('hidden');box.innerHTML=''}}

function escSmart(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function smartList(arr,empty='Nenhum'){return arr.length?`<ul class="smart-list">${arr.map(x=>`<li>${escSmart(x)}</li>`).join('')}</ul>`:`<span class="muted">${empty}</span>`}

function renderSmartRecommendation(rec,requestCode){
  const box=ensureRecommendationUI();if(!box||!rec)return;
  currentSmartRecommendation=rec;
  const total=rec.requestedNames.length||1,inside=rec.coveredNames.length,complete=rec.unsupportedNames.length===0;
  const extraCombo=rec.extraComboNames;
  box.innerHTML=`
    <div class="smart-rec-head"><div><div class="eyebrow">Sugestão inteligente • ${escSmart(requestCode||'cotação')}</div><h3>Combo ${escSmart(rec.combo.level)} é o encaixe mais próximo</h3><div class="muted" style="font-size:13px">${inside} de ${total} necessidades já estão dentro do combo${rec.addons.length?`; ${rec.addons.length} entra${rec.addons.length>1?'m':''} como adicional`:''}.</div></div><div><span class="smart-chip ${complete?'ok':'warn'}">${complete?'Necessidade coberta':'Requer avaliação'}</span><span class="smart-chip">${Math.round((inside/total)*100)}% de aderência direta</span></div></div>
    <div class="smart-grid">
      <div class="smart-box"><b>Já contemplado no combo</b>${smartList(rec.coveredNames,'Nenhuma flag solicitada está dentro do pacote.')}</div>
      <div class="smart-box"><b>Adicionar para completar</b>${smartList(rec.addons,'Nenhum adicional necessário.')}</div>
      <div class="smart-box"><b>Benefícios extras do combo</b>${smartList(extraCombo,'O combo não acrescenta outras flags além das solicitadas.')}</div>
    </div>
    ${rec.unsupportedNames.length?`<div class="smart-box" style="margin-top:10px;border-color:#efd39a;background:#fffaf0"><b>⚠ Fora dos adicionais disponíveis do combo</b>${smartList(rec.unsupportedNames)}<div class="smart-note">Essas flags fazem parte da solicitação original, mas hoje não possuem preço cadastrado como adicional de combo. Por isso não foram incluídas no valor automaticamente. Avalie a composição individual antes de fechar a proposta.</div></div>`:''}
    <div class="smart-note">A recomendação prioriza o combo com maior aderência ao pedido, usando adicionais quando disponíveis. Você pode alterar a composição antes de gerar a proposta.</div>
    ${rec.unsupportedNames.length?`<div class="smart-actions"><button class="secondary" type="button" onclick="openOriginalRequestIndividual()">Ver composição individual completa</button></div>`:''}`;
  box.classList.remove('hidden');
}

function ensureDiscountUI(){
  const actions=document.querySelector('#calculatorView .summary .actions');
  if(!actions||document.getElementById('discountBox'))return;
  const box=document.createElement('div');box.id='discountBox';box.className='internal-box';box.style.cssText='margin-top:14px;background:#f8fbff;border-color:#cfe0f6';
  box.innerHTML=`<div class="eyebrow">Condição comercial</div><label style="margin:8px 0 6px">Desconto na proposta (%)</label><input id="proposalDiscount" type="number" min="0" max="100" step="0.1" value="0" style="width:100%"><div id="discountInfo" class="muted" style="font-size:12px;margin-top:7px">Opcional. Deixe 0 para manter o valor calculado.</div>`;
  actions.parentNode.insertBefore(box,actions);
  document.getElementById('proposalDiscount').addEventListener('input',e=>{commercialDiscountPercent=Math.min(100,Math.max(0,Number(e.target.value)||0));applyCommercialDiscount()});
}

const baseRenderQuote=window.renderQuote;
window.renderQuote=function(x){ensureDiscountUI();if(x&&!x._discount_applied){grossQuote=JSON.parse(JSON.stringify(x));applyCommercialDiscount(false);return}return baseRenderQuote(x)};
function applyCommercialDiscount(render=true){
  if(!grossQuote){if(render)baseRenderQuote(quote);return}
  const pct=commercialDiscountPercent/100,q=JSON.parse(JSON.stringify(grossQuote));
  q.gross_sale_total=Number(grossQuote.sale_total||0);q.gross_sale_unit=Number(grossQuote.sale_unit||0);q.discount_percent=commercialDiscountPercent;q.discount_amount=Number((q.gross_sale_total*pct).toFixed(2));q.sale_total=Number((q.gross_sale_total*(1-pct)).toFixed(2));q.sale_unit=Number((q.gross_sale_unit*(1-pct)).toFixed(4));q.items=(grossQuote.items||[]).map(i=>({...i,commercial_unit:Number((Number(i.commercial_unit||0)*(1-pct)).toFixed(4))}));q._discount_applied=true;quote=q;baseRenderQuote(q);
  const info=document.getElementById('discountInfo');if(info)info.innerHTML=commercialDiscountPercent>0?`Valor original: <b>${money(q.gross_sale_total)}</b> • Desconto: <b>${commercialDiscountPercent.toLocaleString('pt-BR')}%</b> (${money(q.discount_amount)})`:'Opcional. Deixe 0 para manter o valor calculado.';
}
function resetCommercialDiscount(){commercialDiscountPercent=0;grossQuote=null;const el=document.getElementById('proposalDiscount');if(el)el.value='0';const info=document.getElementById('discountInfo');if(info)info.textContent='Opcional. Deixe 0 para manter o valor calculado.'}

function requestFlagMap(r){
  const map=new Map();
  (Array.isArray(r.selection)?r.selection:[]).forEach(x=>{const n=normLeadName(x?.flag);if(n&&!map.has(n))map.set(n,x.flag)});
  return map;
}

async function recommendComboForRequest(r){
  if(r.mode!=='individual'||!Array.isArray(r.selection)||!r.selection.length)return null;
  const person=r.person,requestedMap=requestFlagMap(r),requested=[...requestedMap.keys()];
  const combos=(C.combos||[]).filter(x=>x.person===person),addons=(C.addons||[]).filter(x=>x.person===person),addonByNorm=new Map(addons.map(a=>[normLeadName(a.name),a.name]));
  const candidates=[];
  for(const combo of combos){
    const itemMap=new Map((combo.items||[]).map(x=>[normLeadName(x),x]));
    const covered=requested.filter(flag=>itemMap.has(flag));
    const missing=requested.filter(flag=>!itemMap.has(flag));
    const supportedMissing=missing.filter(flag=>addonByNorm.has(flag));
    const unsupported=missing.filter(flag=>!addonByNorm.has(flag));
    const neededAdds=[...new Set(supportedMissing.map(flag=>addonByNorm.get(flag)))];
    const extraCombo=[...itemMap.keys()].filter(flag=>!requestedMap.has(flag)).map(flag=>itemMap.get(flag));
    const {data,error}=await sb.rpc('calculate_lead_quote',{p_mode:'combo',p_person:person,p_qty:r.quantity,p_selection:{level:combo.level,addons:neededAdds}});
    if(error||!data)continue;
    candidates.push({
      combo,addons:neededAdds,quote:data,
      coveredNames:covered.map(x=>requestedMap.get(x)),
      requestedNames:requested.map(x=>requestedMap.get(x)),
      unsupportedNames:unsupported.map(x=>requestedMap.get(x)),
      extraComboNames:extraCombo,
      directCoverage:covered.length,
      totalCovered:covered.length+supportedMissing.length
    });
  }
  if(!candidates.length)return null;
  // Regra comercial: 1) cobrir mais do pedido (combo + adicionais); 2) ter mais flags já dentro do combo;
  // 3) deixar menos flags fora do pacote; 4) exigir menos adicionais; 5) menor preço.
  candidates.sort((a,b)=>
    b.totalCovered-a.totalCovered ||
    b.directCoverage-a.directCoverage ||
    a.unsupportedNames.length-b.unsupportedNames.length ||
    a.addons.length-b.addons.length ||
    Number(a.quote.sale_total)-Number(b.quote.sale_total)
  );
  return candidates[0];
}

let smartOriginalRequest=null;
const originalLoadRequestFromKanban=window.loadRequestFromKanban;
window.openOriginalRequestIndividual=async function(){
  if(!smartOriginalRequest)return;
  clearRecommendation();resetCommercialDiscount();
  // Carrega a solicitação original pelo fluxo individual já existente.
  const r=smartOriginalRequest;
  currentRequestId=r.id;mode='individual';document.getElementById('person').value=r.person;document.getElementById('qty').value=r.quantity;
  const c=r.client||{};document.getElementById('client').value=c.company||'';document.getElementById('doc').value=c.doc||'';document.getElementById('contact').value=c.contact||'';document.getElementById('clientEmail').value=c.email||'';document.getElementById('phone').value=c.phone||'';document.getElementById('focus').value=c.focus||'';
  selected.clear();selectedAdds.clear();activeProducts=[];(r.selection||[]).forEach(x=>{if(!x?.product||!x?.flag)return;selected.add(JSON.stringify({product:x.product,flag:x.flag}));if(!activeProducts.includes(x.product))activeProducts.push(x.product)});
  document.getElementById('individualArea').classList.remove('hidden');document.getElementById('comboArea').classList.add('hidden');document.getElementById('tabInd').classList.add('active');document.getElementById('tabCombo').classList.remove('active');render();window.scrollTo({top:0,behavior:'smooth'});
};

window.loadRequestFromKanban=async function(id){
  const {data:r,error}=await sb.from('lead_quote_requests').select('*').eq('id',id).single();
  if(error||!r){alert('Não foi possível carregar esta solicitação na calculadora.');return}
  resetCommercialDiscount();clearRecommendation();smartOriginalRequest=r;
  const recommendation=await recommendComboForRequest(r);
  if(!recommendation){await originalLoadRequestFromKanban(id);return}

  currentRequestId=r.id;mode='combo';
  document.getElementById('person').value=r.person;document.getElementById('qty').value=r.quantity;
  const c=r.client||{};document.getElementById('client').value=c.company||'';document.getElementById('doc').value=c.doc||'';document.getElementById('contact').value=c.contact||'';document.getElementById('clientEmail').value=c.email||'';document.getElementById('phone').value=c.phone||'';document.getElementById('focus').value=c.focus||'';
  selected.clear();selectedAdds.clear();activeProducts=[];selectedCombo=recommendation.combo.level;recommendation.addons.forEach(a=>selectedAdds.add(a));
  document.getElementById('individualArea').classList.add('hidden');document.getElementById('comboArea').classList.remove('hidden');document.getElementById('tabInd').classList.remove('active');document.getElementById('tabCombo').classList.add('active');
  const {data:{user}}=await sb.auth.getUser();await sb.from('lead_quote_requests').update({handled_by:user?.id||null,updated_at:new Date().toISOString()}).eq('id',id);
  openSection('calculator');render();renderSmartRecommendation(recommendation,r.code);window.scrollTo({top:0,behavior:'smooth'});
};

ensureDiscountUI();ensureRecommendationUI();
