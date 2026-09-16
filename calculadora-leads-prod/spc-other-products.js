// Outros Produtos SPC — cadastro administrativo + seleção segura na calculadora.
(() => {
  let catalog=[], selectedIds=new Set(), calculated=[];
  const money2=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function loadCatalog(){
    const {data,error}=await sb.rpc('list_spc_other_products');
    if(error){console.error('Outros Produtos SPC:',error);return}
    catalog=data||[]; renderPicker();
  }
  function ensureCalculator(){
    if(document.getElementById('spcOtherProductsBox'))return;
    const panel=document.querySelector('#calculatorView .grid2 > section.panel');if(!panel)return;
    const box=document.createElement('div');box.id='spcOtherProductsBox';box.innerHTML=`<div class="section-title"><div><h3>Outros Produtos SPC</h3><span class="muted">Inclua produtos complementares SPC na mesma proposta.</span></div></div><div class="product-builder"><div id="spcOtherProductsPicker" class="items"></div></div>`;
    panel.appendChild(box);
  }
  function renderPicker(){
    ensureCalculator();const box=document.getElementById('spcOtherProductsPicker');if(!box)return;
    box.innerHTML=catalog.length?catalog.map(p=>`<label class="item"><input type="checkbox" ${selectedIds.has(p.id)?'checked':''} onchange="toggleSpcOtherProduct('${p.id}',this.checked)"><span><b>${esc(p.name)}</b><span>${selectedIds.has(p.id)?(calculated.find(x=>x.id===p.id)?`Investimento: <strong>${money2(calculated.find(x=>x.id===p.id).commercial_unit)}</strong> / unidade`:'Calculando investimento…'):'Selecione para incluir na solução'}</span></span></label>`).join(''):'<p class="muted" style="padding:8px">Nenhum produto complementar cadastrado.</p>';
  }
  window.toggleSpcOtherProduct=async function(id,on){on?selectedIds.add(id):selectedIds.delete(id);await recalc()};
  async function recalc(){
    const qty=Math.max(0,+document.getElementById('qty')?.value||0);calculated=[];
    if(qty&&selectedIds.size){
      const rs=await Promise.all([...selectedIds].map(id=>sb.rpc('calculate_spc_other_product',{p_product_id:id,p_qty:qty})));
      calculated=rs.filter(r=>!r.error&&r.data).map(r=>r.data);
    }
    renderPicker();renderExtraSummary();
  }
  function renderExtraSummary(){
    let box=document.getElementById('spcOtherSummary');const list=document.getElementById('selectedList');if(!list)return;
    if(!box){box=document.createElement('div');box.id='spcOtherSummary';list.insertAdjacentElement('afterend',box)}
    box.innerHTML=calculated.map(x=>`<div class="selected-row"><span>Outro Produto SPC — ${esc(x.name)}</span><b>${money2(x.commercial_unit)} / unidade</b></div>`).join('');
    const base=Number(window.quote?.sale_total||0),extra=calculated.reduce((s,x)=>s+Number(x.sale_total||0),0),total=base+extra;
    if(document.getElementById('salePrice'))document.getElementById('salePrice').textContent=money2(total);
  }
  const originalCalculate=window.calculate;
  if(typeof originalCalculate==='function')window.calculate=async function(){await originalCalculate();await recalc()};

  // Acrescenta os produtos complementares ao objeto salvo da proposta sem expor custos.
  const originalClientData=window.clientData;
  window.clientData=function(){const c=originalClientData();c.spc_other_products=calculated.map(x=>({id:x.id,name:x.name,commercial_unit:x.commercial_unit,sale_total:x.sale_total,quantity:x.quantity}));return c};

  async function ensureAdmin(){
    const role=await (window.portalLoadRole?portalLoadRole():Promise.resolve(''));if(role!=='admin')return;
    const nav=document.querySelector('.mainnav-inner'),main=document.querySelector('main.shell');
    if(nav&&!document.getElementById('navSpcProducts'))nav.insertAdjacentHTML('beforeend','<button id="navSpcProducts" class="navbtn" onclick="openSpcProductsAdmin()">Outros Produtos SPC</button>');
    if(main&&!document.getElementById('spcProductsView'))main.insertAdjacentHTML('beforeend',`<section id="spcProductsView" class="hidden"><div class="toprow"><div><div class="eyebrow">Administração</div><h1>Outros Produtos SPC</h1><p class="muted">Cadastre produtos complementares e seus custos. Estes custos não aparecem no Modo Cliente.</p></div></div><div class="panel"><div class="formgrid"><div><label>Nome do produto</label><input id="spcProductName" placeholder="Ex.: Produto complementar SPC"></div><div><label>Custo unitário SPC</label><input id="spcProductCost" type="number" min="0" step="0.000001" placeholder="0,00"></div><div style="display:flex;align-items:end"><button class="primary" onclick="saveSpcProduct()">Cadastrar produto</button></div></div><div id="spcProductsAdminList" style="margin-top:22px"></div></div></section>`);
  }
  window.openSpcProductsAdmin=async function(){
    await ensureAdmin();['calculatorView','requestsView','proposalsView','usersView'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));document.getElementById('spcProductsView')?.classList.remove('hidden');document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));document.getElementById('navSpcProducts')?.classList.add('active');await renderAdmin();window.scrollTo({top:0,behavior:'smooth'});
  };
  async function renderAdmin(){
    const box=document.getElementById('spcProductsAdminList');if(!box)return;const {data,error}=await sb.from('spc_other_products').select('id,name,unit_cost,active').order('name');
    if(error){box.innerHTML='<p class="muted">Não foi possível carregar o cadastro.</p>';return}
    box.innerHTML=(data||[]).length?`<table class="proposal-table" style="width:100%"><thead><tr><th>Produto</th><th>Custo unitário SPC</th><th>Status</th><th></th></tr></thead><tbody>${data.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${money2(p.unit_cost)}</td><td>${p.active?'Ativo':'Inativo'}</td><td><button class="secondary" onclick="toggleSpcProductActive('${p.id}',${!p.active})">${p.active?'Inativar':'Ativar'}</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">Nenhum produto cadastrado.</p>';
  }
  window.saveSpcProduct=async function(){const name=document.getElementById('spcProductName')?.value.trim(),cost=Number(document.getElementById('spcProductCost')?.value);if(!name||!Number.isFinite(cost)||cost<0){alert('Informe nome e custo unitário válido.');return}const {error}=await sb.from('spc_other_products').insert({name,unit_cost:cost,active:true});if(error){alert('Não foi possível cadastrar o produto.');console.error(error);return}document.getElementById('spcProductName').value='';document.getElementById('spcProductCost').value='';await renderAdmin();await loadCatalog()};
  window.toggleSpcProductActive=async function(id,active){const {error}=await sb.from('spc_other_products').update({active,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert('Não foi possível atualizar o produto.');return}await renderAdmin();await loadCatalog()};

  document.addEventListener('DOMContentLoaded',()=>setTimeout(async()=>{ensureCalculator();await loadCatalog();await ensureAdmin()},500));
})();