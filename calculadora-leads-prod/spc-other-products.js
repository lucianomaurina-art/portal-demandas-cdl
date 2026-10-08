// Outros Produtos SPC — cadastro administrativo, cálculo e persistência na proposta.
(() => {
  let catalog=[],selectedIds=new Set(),calculated=[],calculationError='';
  const money2=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const qty=()=>Math.max(0,+document.getElementById('qty')?.value||0);

  async function loadCatalog(){
    const {data,error}=await sb.rpc('list_spc_other_products');
    if(error){console.error(error);return}
    catalog=data||[];
    renderPicker();
  }

  function ensureCalculator(){
    if(document.getElementById('spcOtherProductsBox'))return;
    const panel=document.querySelector('#calculatorView .grid2 > section.panel');
    if(!panel)return;
    const box=document.createElement('div');
    box.id='spcOtherProductsBox';
    box.innerHTML=`<div class="section-title"><div><h3>Outros Produtos SPC</h3><span class="muted">Inclua produtos complementares SPC na mesma proposta.</span></div></div><div class="product-builder"><div id="spcOtherProductsPicker" class="items"></div><div id="spcOtherProductsError" class="muted" style="display:none;color:#b42318;margin-top:8px"></div></div>`;
    panel.appendChild(box);
  }

  function renderPicker(){
    ensureCalculator();
    const box=document.getElementById('spcOtherProductsPicker'),errorBox=document.getElementById('spcOtherProductsError');
    if(!box)return;
    box.innerHTML=catalog.length?catalog.map(p=>{
      const x=calculated.find(item=>item.id===p.id),selected=selectedIds.has(p.id);
      const detail=selected?(x?`Investimento: <strong>${money2(x.commercial_unit)}</strong> / lead`:'Calculando investimento…'):'Selecione para incluir na solução';
      return `<label class="item"><input type="checkbox" ${selected?'checked':''} onchange="toggleSpcOtherProduct('${p.id}',this.checked)"><span><b>${esc(p.name)}</b><span>${detail}</span></span></label>`;
    }).join(''):'<p class="muted" style="padding:8px">Nenhum produto complementar cadastrado.</p>';
    if(errorBox){errorBox.textContent=calculationError;errorBox.style.display=calculationError?'block':'none'}
  }

  async function calculateSelected(rpcName='calculate_spc_other_product'){
    const quantity=qty();
    if(!quantity||!selectedIds.size){calculated=[];calculationError='';renderPicker();return []}
    const ids=[...selectedIds],responses=await Promise.all(ids.map(id=>sb.rpc(rpcName,{p_product_id:id,p_qty:quantity})));
    const failures=responses.map((response,index)=>({response,id:ids[index]})).filter(x=>x.response.error||!x.response.data);
    if(failures.length){
      failures.forEach(x=>console.error(`Erro ao calcular Outro Produto SPC (${x.id}):`,x.response.error));
      calculationError='Não foi possível calcular um dos produtos adicionais. Nenhuma proposta será salva enquanto o cálculo não estiver completo.';
      renderPicker();
      throw new Error(calculationError);
    }
    const order=new Map(catalog.map((product,index)=>[product.id,index]));
    const results=responses.map(x=>x.data).sort((a,b)=>(order.get(a.id)??999)-(order.get(b.id)??999));
    if(rpcName==='calculate_spc_other_product'){calculated=results;calculationError='';renderPicker()}
    return results;
  }

  function withoutOtherProducts(items){
    return (items||[]).filter(item=>!item.spc_other_product_id&&!String(item.name||'').startsWith('Outro Produto SPC — '));
  }

  window.mergeSpcOtherProductsIntoQuote=async function(baseQuote){
    if(!baseQuote)return baseQuote;
    const products=await calculateSelected();
    const quantity=Math.max(1,Number(baseQuote.quantity||qty()||1));
    const previous=(baseQuote.spc_other_products||[]).reduce((sum,item)=>sum+Number(item.sale_total||0),0);
    const baseTotal=Math.max(0,Number(baseQuote.gross_sale_total??baseQuote.sale_total??0)-previous);
    const extraTotal=products.reduce((sum,item)=>sum+Number(item.sale_total||0),0);
    const extraItems=products.map(item=>({
      name:`Outro Produto SPC — ${item.name}`,
      commercial_unit:Number(item.commercial_unit||0),
      sale_total:Number(item.sale_total||0),
      spc_other_product_id:item.id
    }));
    return {
      ...baseQuote,
      items:[...withoutOtherProducts(baseQuote.items),...extraItems],
      sale_total:baseTotal+extraTotal,
      sale_unit:(baseTotal+extraTotal)/quantity,
      spc_other_products:products.map(item=>({id:item.id,name:item.name,commercial_unit:Number(item.commercial_unit||0),sale_total:Number(item.sale_total||0),quantity:Number(item.quantity||quantity)})),
      _discount_applied:false
    };
  };

  window.mergeSpcOtherProductsIntoInternalQuote=async function(baseQuote){
    if(!baseQuote||!selectedIds.size)return baseQuote;
    const products=await calculateSelected('calculate_spc_other_product_internal');
    const unitCost=Number(baseQuote.unit_cost||0)+products.reduce((sum,item)=>sum+Number(item.unit_cost||0),0);
    const costTotal=Number(baseQuote.cost_total||0)+products.reduce((sum,item)=>sum+Number(item.cost_total||0),0);
    const saleTotal=Number(quote?.gross_sale_total??quote?.sale_total??baseQuote.sale_total??0);
    const markup=costTotal>0?Math.max(0,(saleTotal-costTotal)/costTotal):0;
    return {...baseQuote,unit_cost:unitCost,cost_total:costTotal,markup,spc_other_products_internal:products};
  };

  async function recalculateQuote(){
    calculationError='';renderPicker();
    if(typeof window.calculate==='function')await window.calculate();
    else await calculateSelected();
  }

  window.toggleSpcOtherProduct=async(id,on)=>{
    on?selectedIds.add(id):selectedIds.delete(id);
    calculated=calculated.filter(item=>selectedIds.has(item.id));
    try{await recalculateQuote()}catch(error){console.error(error)}
  };

  // A proposta sempre refaz a cotação completa antes de salvar. Assim o adicional
  // não depende da ordem em que os módulos da calculadora foram carregados.
  window.syncSpcOtherProductsQuote=async()=>{
    if(typeof window.calculate==='function')await window.calculate();
    if(selectedIds.size&&(!quote||calculationError))throw new Error(calculationError||'Produtos adicionais não calculados.');
    return quote;
  };

  const originalSaveProposal=window.saveProposal;
  if(typeof originalSaveProposal==='function')window.saveProposal=async function(status='Rascunho',silent=false){
    try{await window.syncSpcOtherProductsQuote()}
    catch(error){console.error(error);if(!silent)alert('Não foi possível recalcular os produtos adicionais. Revise a seleção e tente novamente.');return null}
    return originalSaveProposal.apply(this,arguments);
  };

  function setSelectedProducts(source){
    const products=Array.isArray(source)?source:[];
    selectedIds=new Set(products.map(item=>item?.id).filter(Boolean));
    calculated=products.filter(item=>item?.id).map(item=>({...item,commercial_unit:Number(item.commercial_unit||0),sale_total:Number(item.sale_total||0),quantity:Number(item.quantity||0)}));
    calculationError='';renderPicker();
  }
  function productsFromRecord(record){return record?.quote?.spc_other_products?.length?record.quote.spc_other_products:(record?.client?.spc_other_products||[])}
  function clearSelectedProducts(){setSelectedProducts([])}

  const originalReset=window.resetSelection;
  if(typeof originalReset==='function')window.resetSelection=function(){clearSelectedProducts();return originalReset.apply(this,arguments)};

  const originalLoadRequest=window.loadRequest;
  if(typeof originalLoadRequest==='function')window.loadRequest=async function(id){
    const {data}=await sb.from('lead_quote_requests').select('client').eq('id',id).maybeSingle();
    setSelectedProducts(data?.client?.spc_other_products||[]);
    return originalLoadRequest.apply(this,arguments);
  };

  const originalKanban=window.loadRequestFromKanban;
  if(typeof originalKanban==='function')window.loadRequestFromKanban=async function(id){
    const {data}=await sb.from('lead_quote_requests').select('client').eq('id',id).maybeSingle();
    setSelectedProducts(data?.client?.spc_other_products||[]);
    return originalKanban.apply(this,arguments);
  };

  const originalEditProposal=window.editProposal;
  if(typeof originalEditProposal==='function')window.editProposal=async function(id){
    const {data}=await sb.from('lead_proposals').select('quote,client').eq('id',id).maybeSingle();
    setSelectedProducts(productsFromRecord(data));
    return originalEditProposal.apply(this,arguments);
  };

  // O cliente e a cotação carregam a mesma seleção para garantir recuperação e auditoria.
  const originalClientData=window.clientData;
  window.clientData=function(){
    const client=originalClientData();
    client.spc_other_products=calculated.map(item=>({id:item.id,name:item.name,commercial_unit:Number(item.commercial_unit||0),sale_total:Number(item.sale_total||0),quantity:Number(item.quantity||0)}));
    return client;
  };

  async function getRole(){const {data:{user}}=await sb.auth.getUser();if(!user)return '';const {data}=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle();return data?.role||''}
  async function ensureAdmin(){if(await getRole()!=='admin')return;const nav=document.querySelector('.mainnav-inner'),main=document.querySelector('main.shell');if(nav&&!document.getElementById('navSpcProducts'))nav.insertAdjacentHTML('beforeend','<button id="navSpcProducts" class="navbtn" onclick="openSpcProductsAdmin()">Outros Produtos SPC</button>');if(main&&!document.getElementById('spcProductsView'))main.insertAdjacentHTML('beforeend',`<section id="spcProductsView" class="hidden"><div class="toprow"><div><div class="eyebrow">Administração</div><h1>Outros Produtos SPC</h1><p class="muted">Cadastre produtos complementares e seus custos. Estes custos não aparecem no Modo Cliente.</p></div></div><div class="panel"><div class="formgrid"><div><label>Nome do produto</label><input id="spcProductName"></div><div><label>Custo unitário SPC</label><input id="spcProductCost" type="number" min="0" step="0.000001" placeholder="0,00"></div><div style="display:flex;align-items:end"><button class="primary" onclick="saveSpcProduct()">Cadastrar produto</button></div></div><div id="spcProductsAdminList" style="margin-top:22px"></div></div></section>`)}
  window.openSpcProductsAdmin=async()=>{await ensureAdmin();['calculatorView','requestsView','proposalsView','usersView'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));document.getElementById('spcProductsView')?.classList.remove('hidden');document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));document.getElementById('navSpcProducts')?.classList.add('active');await renderAdmin();scrollTo({top:0,behavior:'smooth'})};
  async function renderAdmin(){const box=document.getElementById('spcProductsAdminList');if(!box)return;const {data,error}=await sb.from('spc_other_products').select('id,name,unit_cost,active').order('name');if(error){box.innerHTML='<p class="muted">Não foi possível carregar o cadastro.</p>';return}box.innerHTML=(data||[]).length?`<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Produto</th><th style="text-align:left">Custo unitário SPC</th><th>Status</th><th></th></tr></thead><tbody>${data.map(p=>`<tr><td style="padding:10px 0"><b>${esc(p.name)}</b></td><td>${money2(p.unit_cost)}</td><td>${p.active?'Ativo':'Inativo'}</td><td><button class="secondary" onclick="toggleSpcProductActive('${p.id}',${!p.active})">${p.active?'Inativar':'Ativar'}</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Nenhum produto cadastrado.</p>'}
  window.saveSpcProduct=async()=>{const name=document.getElementById('spcProductName')?.value.trim(),cost=Number(document.getElementById('spcProductCost')?.value);if(!name||!Number.isFinite(cost)||cost<0){alert('Informe nome e custo unitário válido.');return}const {error}=await sb.from('spc_other_products').insert({name,unit_cost:cost,active:true});if(error){alert('Não foi possível cadastrar o produto.');console.error(error);return}document.getElementById('spcProductName').value='';document.getElementById('spcProductCost').value='';await renderAdmin();await loadCatalog()};
  window.toggleSpcProductActive=async(id,active)=>{const {error}=await sb.from('spc_other_products').update({active,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert('Não foi possível atualizar o produto.');return}await renderAdmin();await loadCatalog()};
  setTimeout(async()=>{ensureCalculator();await loadCatalog();await ensureAdmin()},650);
})();
