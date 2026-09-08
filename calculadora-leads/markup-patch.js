(() => {
  const money = window.money || (v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));

  function commercialRange(cost){
    if(cost<=0) return 'Selecione os itens para calcular a faixa comercial.';
    if(cost<=2500) return 'Faixa comercial: base pequena • markup de 100%';
    if(window.mode==='combo' && cost<=15000) return 'Faixa comercial: base média • markup de 30%';
    if(window.mode==='combo') return 'Faixa comercial: base grande • markup de 15%';
    if(cost<=30000) return 'Faixa comercial: base média • markup de 30%';
    return 'Faixa comercial: base grande • markup de 15%';
  }

  const oldCalculate = window.calculate;
  window.calculate = function(){
    oldCalculate();
    const c = window.calculation();
    const salePrice = document.getElementById('salePrice');
    if(salePrice){
      const label = salePrice.nextElementSibling;
      if(label) label.textContent = 'investimento total ao cliente';
      let unitRow = document.getElementById('saleUnitRow');
      if(!unitRow){
        unitRow = document.createElement('div');
        unitRow.id='saleUnitRow';
        unitRow.className='kv';
        unitRow.style.fontSize='14px';
        unitRow.style.marginTop='12px';
        unitRow.innerHTML='<span>Preço comercial médio / lead</span><b id="saleUnit">R$ 0,00</b>';
        label.insertAdjacentElement('afterend',unitRow);
        const band=document.createElement('div');
        band.id='commercialBand';band.className='notice';band.style.marginTop='14px';
        unitRow.insertAdjacentElement('afterend',band);
      }
      document.getElementById('saleUnit').textContent=money(c.q>0?c.sale/c.q:0);
      document.getElementById('commercialBand').textContent=commercialRange(c.cost);
    }
    const bandLabel=document.getElementById('bandLabel');
    if(bandLabel) bandLabel.textContent='Faixa de volume: '+c.band;
    const unitLabel=document.getElementById('unitCost')?.parentElement?.querySelector('span');
    const totalLabel=document.getElementById('totalCost')?.parentElement?.querySelector('span');
    if(unitLabel) unitLabel.textContent='Custo unitário SPC';
    if(totalLabel) totalLabel.textContent='Custo total SPC';
  };

  window.estimatedComboAddonUnit = function(x){
    const q=Math.max(0,+document.getElementById('qty').value||0),min=Math.max(0,+document.getElementById('minimum').value||0),person=document.getElementById('person').value,b=window.bandIndex(q,true);
    const c=window.COMBOS.find(r=>r.person===person&&r.level===window.selectedCombo);let cost=(c?c.prices[b]:0)*q;
    window.ADDONS.filter(r=>r.person===person).forEach(r=>{let k=person+'|'+r.name;if(window.selectedAdds.has(k)||r===x)cost+=r.prices[b]*q});
    return x.prices[b]*window.saleFactor(cost,min,true);
  };

  const oldRenderCombo=window.renderCombo;
  window.renderCombo=function(){
    oldRenderCombo();
    const person=document.getElementById('person').value;
    document.querySelectorAll('#comboAdds .item').forEach((el,i)=>{
      const x=window.ADDONS.filter(r=>r.person===person)[i];
      if(!x) return;
      const span=el.querySelector('span span');
      if(span) span.innerHTML='Preço comercial estimado: <strong>'+money(window.estimatedComboAddonUnit(x))+'</strong> / lead';
    });
  };

  const oldProposalHtml=window.proposalHtml;
  window.proposalHtml=function(c,cl,id){
    return oldProposalHtml(c,cl,id)
      .replace('Faixa aplicada: '+c.band+' • Tipo: '+c.person+' • Custo interno total: não exibido na versão enviada ao cliente.','Faixa de volume aplicada: '+c.band+' • Tipo: '+c.person+'.');
  };

  const summary=document.querySelector('.summary');
  const internal=document.getElementById('unitCost')?.parentElement;
  if(summary && internal && !document.getElementById('internalEyebrow')){
    const e=document.createElement('div');e.id='internalEyebrow';e.className='eyebrow';e.style.marginTop='4px';e.textContent='Visão interna';internal.insertAdjacentElement('beforebegin',e);
  }
  window.calculate();
})();