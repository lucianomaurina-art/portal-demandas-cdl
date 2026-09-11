// Recomendação inteligente de combos + desconto comercial opcional
let commercialDiscountPercent=0;
let grossQuote=null;
let currentSmartRecommendation=null;
let smartOriginalRequest=null;
let smartComparison=null;

const normLeadName=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
  .replace(/\s+1$/,'')
  .replace(/^nome$/,'nome completo').replace(/^endereco$/,'endereco completo').replace(/^data de abertura$/,'data de fundacao')
  .replace(/^restricao spc$/,'restricao 1 bureau').replace(/^restricao spc e serasa$/,'restricao 2 bureaux')
  .replace(/^quadro social administrativo$/,'quadro social e administrativo');

function ensureSmartStyles(){
  if(document.getElementById('smartQuoteStyles'))return;
  const s=document.createElement('style');s.id='smartQuoteStyles';s.textContent=`
  .smart-rec{border:1px solid #b9d5fb;background:#f6faff;border-radius:16px;padding:18px;margin:0 0 18px;box-shadow:0 5px 18px rgba(11,98,214,.06)}
  .smart-rec-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.smart-rec h3{margin:4px 0 4px;color:#071b33}.smart-chip{display:inline-flex;align-items:center;border-radius:999px;background:#e8f1ff;color:#084fae;font-size:11px;font-weight:900;padding:6px 9px;margin:4px 5px 0 0}.smart-chip.ok{background:#e7f6ef;color:#176b4d}.smart-chip.warn{background:#fff4df;color:#8a5a00}.smart-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.smart-box{background:#fff;border:1px solid #dce3ed;border-radius:12px;padding:12px;font-size:12px;line-height:1.45}.smart-box b{display:block;color:#071b33;margin-bottom:5px}.smart-list{margin:5px 0 0;padding-left:18px}.smart-note{font-size:12px;color:#667085;margin-top:12px;line-height:1.45}.smart-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.smart-compare{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.smart-price{font-size:22px;font-weight:900;color:#071b33;margin:4px 0}.smart-price.best{color:#176b4d}.smart-selected{border:2px solid #0b62d6}.smart-diff{margin-top:8px;font-size:12px;font-weight:800}@media(max-width:760px){.smart-grid,.smart-compare{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
}
function ensureRecommendationUI(){ensureSmartStyles();let box=document.getElementById('smartRecommendation');if(box)return box;const panel=document.querySelector('#calculatorView .grid2 > .panel');if(!panel)return null;box=document.createElement('div');box.id='smartRecommendation';box.className='smart-rec hidden';panel.insertBefore(box,panel.firstChild);return box}
function clearRecommendation(resetMemory=false){currentSmartRecommendation=null;const box=document.getElementById('smartRecommendation');if(box){box.classList.add('hidden');box.innerHTML=''}if(resetMemory){smartOriginalRequest=null;smartComparison=null}}
function escSmart(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function smartList(arr,empty='Nenhum'){return arr.length?`<ul class="smart-list">${arr.map(x=>`<li>${escSmart(x)}</li>`).join('')}</ul>`:`<span class="muted">${empty}</span>`}
function comparisonHtml(activeMode){
  if(!smartComparison?.comboQuote||!smartComparison?.individualQuote)return '';
  const cq=smartComparison.comboQuote,iq=smartComparison.individualQuote,cv=Number(cq.sale_total||0),iv=Number(iq.sale_total||0),best=Math.min(cv,iv),diff=Math.abs(cv-iv);
  return `<div class="smart-compare"><div class="smart-box ${activeMode==='combo'?'smart-selected':''}"><b>Opção Combo ${escSmart(smartComparison.recommendation.combo.level)}</b><div class="smart-price ${cv===best?'best':''}">${money(cv)}</div><span class="muted">${smartComparison.recommendation.addons.length?`${smartComparison.recommendation.addons.length} adicional(is) para completar`:'Sem adicionais necessários'}</span>${cv===best?'<div class="smart-diff">✓ Menor investimento nesta comparação</div>':''}</div><div class="smart-box ${activeMode==='individual'?'smart-selected':''}"><b>Composição individual</b><div class="smart-price ${iv===best?'best':''}">${money(iv)}</div><span class="muted">Somente as flags originalmente solicitadas</span>${iv===best?'<div class="smart-diff">✓ Menor investimento nesta comparação</div>':''}</div></div><div class="smart-note">Diferença entre as opções: <b>${money(diff)}</b>. A comparação permanece disponível enquanto você alterna entre Combo e Individual.</div>`;
}
function renderSmartRecommendation(rec,requestCode,activeMode='combo'){
  const box=ensureRecommendationUI();if(!box||!rec)return;currentSmartRecommendation=rec;
  const total=rec.requestedNames.length||1,inside=rec.coveredNames.length,complete=rec.unsupportedNames.length===0;
  box.innerHTML=`<div class="smart-rec-head"><div><div class="eyebrow">Sugestão inteligente • ${escSmart(requestCode||'cotação')}</div><h3>Combo ${escSmart(rec.combo.level)} é a alternativa de combo mais próxima</h3><div class="muted" style="font-size:13px">${inside} de ${total} necessidades já estão dentro do combo${rec.addons.length?`; ${rec.addons.length} entra${rec.addons.length>1?'m':''} como adicional`:''}. A recomendação limita benefícios extras não solicitados.</div></div><div><span class="smart-chip ${complete?'ok':'warn'}">${complete?'Necessidade coberta':'Requer avaliação'}</span><span class="smart-chip">${Math.round((inside/total)*100)}% de aderência direta</span></div></div>
  <div class="smart-grid"><div class="smart-box"><b>Já contemplado no combo</b>${smartList(rec.coveredNames,'Nenhuma flag solicitada está dentro do pacote.')}</div><div class="smart-box"><b>Adicionar para completar</b>${smartList(rec.addons,'Nenhum adicional necessário.')}</div><div class="smart-box"><b>Benefícios extras do combo</b>${smartList(rec.extraComboNames,'O combo não acrescenta outras flags além das solicitadas.')}</div></div>
  ${rec.unsupportedNames.length?`<div class="smart-box" style="margin-top:10px;border-color:#efd39a;background:#fffaf0"><b>⚠ Fora dos adicionais disponíveis do combo</b>${smartList(rec.unsupportedNames)}<div class="smart-note">Estas flags fazem parte do pedido original e não possuem preço cadastrado como adicional de combo. Compare com a composição individual antes de fechar.</div></div>`:''}
  ${comparisonHtml(activeMode)}
  <div class="smart-actions"><button class="secondary" type="button" onclick="showSmartIndividual()">Ver Individual</button><button class="secondary" type="button" onclick="showSmartCombo()">Ver Combo recomendado</button></div>`;
  box.classList.remove('hidden');
}

function ensureDiscountUI(){const actions=document.querySelector('#calculatorView .summary .actions');if(!actions||document.getElementById('discountBox'))return;const box=document.createElement('div');box.id='discountBox';box.className='internal-box';box.style.cssText='margin-top:14px;background:#f8fbff;border-color:#cfe0f6';box.innerHTML=`<div class="eyebrow">Condição comercial</div><label style="margin:8px 0 6px">Desconto na proposta (%)</label><input id="proposalDiscount" type="number" min="0" max="100" step="0.1" value="0" style="width:100%"><div id="discountInfo" class="muted" style="font-size:12px;margin-top:7px">Opcional. Deixe 0 para manter o valor calculado.</div>`;actions.parentNode.insertBefore(box,actions);document.getElementById('proposalDiscount').addEventListener('input',e=>{commercialDiscountPercent=Math.min(100,Math.max(0,Number(e.target.value)||0));applyCommercialDiscount()})}
const baseRenderQuote=window.renderQuote;
window.renderQuote=function(x){ensureDiscountUI();if(x&&!x._discount_applied){grossQuote=JSON.parse(JSON.stringify(x));applyCommercialDiscount(false);return}return baseRenderQuote(x)};
function applyCommercialDiscount(render=true){if(!grossQuote){if(render)baseRenderQuote(quote);return}const pct=commercialDiscountPercent/100,q=JSON.parse(JSON.stringify(grossQuote));q.gross_sale_total=Number(grossQuote.sale_total||0);q.gross_sale_unit=Number(grossQuote.sale_unit||0);q.discount_percent=commercialDiscountPercent;q.discount_amount=Number((q.gross_sale_total*pct).toFixed(2));q.sale_total=Number((q.gross_sale_total*(1-pct)).toFixed(2));q.sale_unit=Number((q.gross_sale_unit*(1-pct)).toFixed(4));q.items=(grossQuote.items||[]).map(i=>({...i,commercial_unit:Number((Number(i.commercial_unit||0)*(1-pct)).toFixed(4))}));q._discount_applied=true;quote=q;baseRenderQuote(q);const info=document.getElementById('discountInfo');if(info)info.innerHTML=commercialDiscountPercent>0?`Valor original: <b>${money(q.gross_sale_total)}</b> • Desconto: <b>${commercialDiscountPercent.toLocaleString('pt-BR')}%</b> (${money(q.discount_amount)})`:'Opcional. Deixe 0 para manter o valor calculado.'}
function resetCommercialDiscount(){commercialDiscountPercent=0;grossQuote=null;const el=document.getElementById('proposalDiscount');if(el)el.value='0';const info=document.getElementById('discountInfo');if(info)info.textContent='Opcional. Deixe 0 para manter o valor calculado.'}
function requestFlagMap(r){const map=new Map();(Array.isArray(r.selection)?r.selection:[]).forEach(x=>{const n=normLeadName(x?.flag);if(n&&!map.has(n))map.set(n,x.flag)});return map}

async function recommendComboForRequest(r){
  if(r.mode!=='individual'||!Array.isArray(r.selection)||!r.selection.length)return null;
  const person=r.person,requestedMap=requestFlagMap(r),requested=[...requestedMap.keys()],combos=(C.combos||[]).filter(x=>x.person===person),addons=(C.addons||[]).filter(x=>x.person===person),addonByNorm=new Map(addons.map(a=>[normLeadName(a.name),a.name]));
  const {data:individualQuote,error:individualError}=await sb.rpc('calculate_lead_quote',{p_mode:'individual',p_person:person,p_qty:r.quantity,p_selection:r.selection});
  const candidates=[];
  for(const combo of combos){
    const itemMap=new Map((combo.items||[]).map(x=>[normLeadName(x),x])),covered=requested.filter(f=>itemMap.has(f)),missing=requested.filter(f=>!itemMap.has(f)),supportedMissing=missing.filter(f=>addonByNorm.has(f)),unsupported=missing.filter(f=>!addonByNorm.has(f)),neededAdds=[...new Set(supportedMissing.map(f=>addonByNorm.get(f)))],extraCombo=[...itemMap.keys()].filter(f=>!requestedMap.has(f)).map(f=>itemMap.get(f));
    // Regra: não recomendar upgrade que acrescente mais de 2 flags que o cliente não pediu.
    if(extraCombo.length>2)continue;
    const {data,error}=await sb.rpc('calculate_lead_quote',{p_mode:'combo',p_person:person,p_qty:r.quantity,p_selection:{level:combo.level,addons:neededAdds}});if(error||!data)continue;
    candidates.push({combo,addons:neededAdds,quote:data,coveredNames:covered.map(x=>requestedMap.get(x)),requestedNames:requested.map(x=>requestedMap.get(x)),unsupportedNames:unsupported.map(x=>requestedMap.get(x)),extraComboNames:extraCombo,directCoverage:covered.length,totalCovered:covered.length+supportedMissing.length});
  }
  if(!candidates.length)return {recommendation:null,individualQuote:individualError?null:individualQuote};
  // Primeiro minimiza o que ficou sem cobertura; depois extras não pedidos e adicionais; preço desempata.
  candidates.sort((a,b)=>a.unsupportedNames.length-b.unsupportedNames.length||a.extraComboNames.length-b.extraComboNames.length||a.addons.length-b.addons.length||b.directCoverage-a.directCoverage||Number(a.quote.sale_total)-Number(b.quote.sale_total));
  return {recommendation:candidates[0],individualQuote:individualError?null:individualQuote};
}

function fillBaseRequest(r){currentRequestId=r.id;document.getElementById('person').value=r.person;document.getElementById('qty').value=r.quantity;const c=r.client||{};document.getElementById('client').value=c.company||'';document.getElementById('doc').value=c.doc||'';document.getElementById('contact').value=c.contact||'';document.getElementById('clientEmail').value=c.email||'';document.getElementById('phone').value=c.phone||'';document.getElementById('focus').value=c.focus||''}
window.showSmartIndividual=function(){if(!smartOriginalRequest)return;resetCommercialDiscount();const r=smartOriginalRequest;fillBaseRequest(r);mode='individual';selected.clear();selectedAdds.clear();activeProducts=[];(r.selection||[]).forEach(x=>{if(!x?.product||!x?.flag)return;selected.add(JSON.stringify({product:x.product,flag:x.flag}));if(!activeProducts.includes(x.product))activeProducts.push(x.product)});document.getElementById('individualArea').classList.remove('hidden');document.getElementById('comboArea').classList.add('hidden');document.getElementById('tabInd').classList.add('active');document.getElementById('tabCombo').classList.remove('active');render();if(smartComparison?.recommendation)renderSmartRecommendation(smartComparison.recommendation,r.code,'individual');window.scrollTo({top:0,behavior:'smooth'})};
window.showSmartCombo=function(){if(!smartOriginalRequest||!smartComparison?.recommendation)return;resetCommercialDiscount();const r=smartOriginalRequest,rec=smartComparison.recommendation;fillBaseRequest(r);mode='combo';selected.clear();selectedAdds.clear();activeProducts=[];selectedCombo=rec.combo.level;rec.addons.forEach(a=>selectedAdds.add(a));document.getElementById('individualArea').classList.add('hidden');document.getElementById('comboArea').classList.remove('hidden');document.getElementById('tabInd').classList.remove('active');document.getElementById('tabCombo').classList.add('active');render();renderSmartRecommendation(rec,r.code,'combo');window.scrollTo({top:0,behavior:'smooth'})};
window.openOriginalRequestIndividual=window.showSmartIndividual;

const originalLoadRequestFromKanban=window.loadRequestFromKanban;
window.loadRequestFromKanban=async function(id){
  const {data:r,error}=await sb.from('lead_quote_requests').select('*').eq('id',id).single();if(error||!r){alert('Não foi possível carregar esta solicitação na calculadora.');return}
  resetCommercialDiscount();clearRecommendation(true);smartOriginalRequest=r;
  const result=await recommendComboForRequest(r),rec=result?.recommendation;
  if(!rec){await originalLoadRequestFromKanban(id);smartOriginalRequest=r;return}
  smartComparison={recommendation:rec,comboQuote:rec.quote,individualQuote:result.individualQuote};
  fillBaseRequest(r);mode='combo';selected.clear();selectedAdds.clear();activeProducts=[];selectedCombo=rec.combo.level;rec.addons.forEach(a=>selectedAdds.add(a));document.getElementById('individualArea').classList.add('hidden');document.getElementById('comboArea').classList.remove('hidden');document.getElementById('tabInd').classList.remove('active');document.getElementById('tabCombo').classList.add('active');const {data:{user}}=await sb.auth.getUser();await sb.from('lead_quote_requests').update({handled_by:user?.id||null,updated_at:new Date().toISOString()}).eq('id',id);openSection('calculator');render();renderSmartRecommendation(rec,r.code,'combo');window.scrollTo({top:0,behavior:'smooth'});
};
ensureDiscountUI();ensureRecommendationUI();
