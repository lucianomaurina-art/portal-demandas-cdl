// Correção de regressão da comparação inteligente.
// A recomendação deve continuar visível mesmo quando nenhum combo consegue atender
// o pedido com até 2 adicionais. Nesses casos, mostramos o combo mais próximo
// e sinalizamos que ele excede a política recomendada de até 2 adicionais.
window.recommendComboForRequest=async function(r){
  if(r.mode!=='individual'||!Array.isArray(r.selection)||!r.selection.length)return null;
  const person=r.person;
  const requestedMap=requestFlagMap(r);
  const requested=[...requestedMap.keys()];
  const combos=(C.combos||[]).filter(x=>x.person===person);
  const addons=(C.addons||[]).filter(x=>x.person===person);
  const addonByNorm=new Map(addons.map(a=>[normLeadName(a.name),a.name]));

  const {data:individualQuote,error:individualError}=await sb.rpc('calculate_lead_quote',{
    p_mode:'individual',p_person:person,p_qty:r.quantity,p_selection:r.selection
  });

  const candidates=[];
  for(const combo of combos){
    const itemMap=new Map((combo.items||[]).map(x=>[normLeadName(x),x]));
    const covered=requested.filter(f=>itemMap.has(f));
    const missing=requested.filter(f=>!itemMap.has(f));
    const supportedMissing=missing.filter(f=>addonByNorm.has(f));
    const unsupported=missing.filter(f=>!addonByNorm.has(f));
    const neededAdds=[...new Set(supportedMissing.map(f=>addonByNorm.get(f)))];
    const extraCombo=[...itemMap.keys()].filter(f=>!requestedMap.has(f)).map(f=>itemMap.get(f));

    const {data,error}=await sb.rpc('calculate_lead_quote',{
      p_mode:'combo',p_person:person,p_qty:r.quantity,
      p_selection:{level:combo.level,addons:neededAdds}
    });
    if(error||!data)continue;

    candidates.push({
      combo,
      addons:neededAdds,
      quote:data,
      coveredNames:covered.map(x=>requestedMap.get(x)),
      requestedNames:requested.map(x=>requestedMap.get(x)),
      unsupportedNames:unsupported.map(x=>requestedMap.get(x)),
      extraComboNames:extraCombo,
      directCoverage:covered.length,
      withinAddonPolicy:neededAdds.length<=2
    });
  }

  if(!candidates.length)return {recommendation:null,individualQuote:individualError?null:individualQuote};

  // 1) Se existir opção com até 2 adicionais, ela tem prioridade.
  // 2) Se nenhuma existir, ainda mostramos a melhor alternativa disponível,
  //    preservando toda a comparação Individual x Combo.
  candidates.sort((a,b)=>
    Number(b.withinAddonPolicy)-Number(a.withinAddonPolicy)||
    a.unsupportedNames.length-b.unsupportedNames.length||
    a.addons.length-b.addons.length||
    a.extraComboNames.length-b.extraComboNames.length||
    b.directCoverage-a.directCoverage||
    Number(a.quote.sale_total)-Number(b.quote.sale_total)
  );

  return {recommendation:candidates[0],individualQuote:individualError?null:individualQuote};
};

// Complementa a comunicação visual quando a melhor alternativa exige mais de 2 adicionais.
const _renderSmartRecommendationRegression=window.renderSmartRecommendation;
window.renderSmartRecommendation=function(rec,requestCode,activeMode='individual'){
  _renderSmartRecommendationRegression(rec,requestCode,activeMode);
  if(!rec||rec.addons?.length<=2)return;
  const box=document.getElementById('smartRecommendation');
  if(!box)return;
  const warning=document.createElement('div');
  warning.className='smart-missing';
  warning.style.marginTop='12px';
  warning.innerHTML=`<b>⚠ Atenção à composição</b><div class="smart-note">Nenhum combo atende esta solicitação com no máximo 2 adicionais. Por isso, a plataforma está exibindo o combo mais próximo para comparação. Revise os ${rec.addons.length} adicionais antes de fechar a proposta.</div>`;
  box.appendChild(warning);
};