// Evoluções de navegação e combos — Portal Comercial CDL NH
(function(){
  const C=window.LEAD_CATALOG||{combos:[],addons:[]};

  function normalize(s){
    return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  }

  // Mantém Solicitações e Propostas fora da tela da calculadora.
  function setupManagementLink(){
    const topActions=document.querySelector('.top-actions');
    if(topActions){
      topActions.innerHTML='<a class="ghost" href="gestao.html" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center">Gestão comercial</a>';
    }
    document.getElementById('requests')?.remove();
    document.getElementById('history')?.remove();
  }

  // Filtra adicionais que já estejam contidos no combo selecionado.
  window.renderCombo=function(){
    const person=document.getElementById('person').value;
    const cs=C.combos.filter(x=>x.person===person);
    if(!cs.some(x=>x.level===selectedCombo)) selectedCombo=cs[0]?.level||'Básico';

    const comboCards=document.getElementById('comboCards');
    comboCards.innerHTML=cs.map(c=>`<div class="combo ${c.level===selectedCombo?'active':''}" onclick="selectedCombo='${c.level}';renderCombo();scheduleQuote()"><h4>${c.level}</h4><div class="muted">${c.level===selectedCombo&&quote?`Investimento: <b>${money(quote.sale_unit)}</b> / lead`:'Selecione para simular'}</div><ul>${c.items.map(i=>`<li>${i}</li>`).join('')}</ul><button class="${c.level===selectedCombo?'primary':'ghost'}">${c.level===selectedCombo?'Selecionado':'Selecionar'}</button></div>`).join('');

    const current=cs.find(x=>x.level===selectedCombo);
    const included=new Set((current?.items||[]).map(normalize));
    const synonyms={
      'nomecompleto':['nome'],
      'enderecocompleto':['endereco'],
      'datadenascimento':['datadenascimento'],
      'razaosocial':['razaosocial'],
      'nomefantasia':['nomefantasia'],
      'datadefundacao':['datadeabertura'],
      'quadrosocialeadministrativo':['quadrosocialadministrativo'],
      'restricao1bureau':['restricaospc'],
      'restricao2bureaux':['restricaospceserasa'],
      'statusrf':['statusdarF','statusrf']
    };
    const isIncluded=name=>{
      const n=normalize(name);
      if(included.has(n)) return true;
      const alts=(synonyms[n]||[]).map(normalize);
      return alts.some(a=>included.has(a));
    };

    // Remove também qualquer adicional previamente selecionado que agora passou a fazer parte do combo.
    [...selectedAdds].forEach(a=>{if(isIncluded(a))selectedAdds.delete(a)});

    const adds=C.addons.filter(x=>x.person===person&&!isIncluded(x.name));
    document.getElementById('comboAdds').innerHTML=adds.length?adds.map(x=>`<label class="item"><input type="checkbox" ${selectedAdds.has(x.name)?'checked':''} onchange='toggleAddon(${JSON.stringify(x.name)})'><span><b>${x.name}</b><span>${selectedAdds.has(x.name)?itemCommercialLabel('Adicional — '+x.name):'Opcional'}</span></span></label>`).join(''):'<p class="muted">Este combo já contempla todos os atributos adicionais disponíveis.</p>';
  };

  // Permite carregar uma solicitação diretamente da página de Gestão.
  async function tryLoadRequestFromUrl(){
    const id=new URLSearchParams(location.search).get('request');
    if(!id) return;
    const wait=()=>new Promise(r=>setTimeout(r,120));
    for(let i=0;i<25;i++){
      if(!document.getElementById('app')?.classList.contains('hidden') && typeof window.loadRequest==='function'){
        await window.loadRequest(id);
        history.replaceState({},'',location.pathname);
        return;
      }
      await wait();
    }
  }

  setupManagementLink();
  setTimeout(tryLoadRequestFromUrl,350);
})();
