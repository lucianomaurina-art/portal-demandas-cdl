// Ajustes do formulário operacional de contagem conforme Formulário SPC Dados.
// Estado, CEP e Cidade ficam separados; faturamento PJ usa as faixas oficiais do formulário.
// Também registra se a solicitação está baseada em contagem anterior e o respectivo RC.
(()=>{
  const STATES=['Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal','Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul','Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí','Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia','Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins'];
  const REVENUE=['TODOS','DE R$ 3.800,00 A R$ 7.600,00','MAIOR QUE R$ 7.600,00','OUTRO VALOR'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
  const val=id=>document.getElementById(id)?.value?.trim()||'';

  function replaceWithSelect(input,options,placeholder){
    if(!input||input.tagName==='SELECT')return input;
    const current=input.value||'';
    const select=document.createElement('select');
    select.id=input.id;
    select.className=input.className;
    select.style.cssText=input.style.cssText||'';
    select.innerHTML=`<option value="">${esc(placeholder)}</option>`+options.map(x=>`<option value="${esc(x)}" ${norm(x)===norm(current)?'selected':''}>${esc(x)}</option>`).join('');
    if(current&&!options.some(x=>norm(x)===norm(current)))select.insertAdjacentHTML('beforeend',`<option value="${esc(current)}" selected>${esc(current)}</option>`);
    input.replaceWith(select);
    return select;
  }

  function addCepField(cityInput,storedCep=''){
    if(!cityInput||document.getElementById('soCep'))return;
    const cityWrap=cityInput.parentElement;if(!cityWrap)return;
    const wrap=document.createElement('div');
    wrap.innerHTML=`<label>CEP(s)</label><input id="soCep" value="${esc(storedCep)}" placeholder="Ex.: 93510-000; 93520-000">`;
    cityWrap.parentElement?.insertBefore(wrap,cityWrap);
  }

  function updateCityLabel(cityInput){
    const label=cityInput?.parentElement?.querySelector('label');if(label)label.textContent='Cidade(s)';
    if(cityInput)cityInput.placeholder='Ex.: Novo Hamburgo; Campo Bom; Estância Velha';
  }

  function revenueOtherControl(select,storedOther=''){
    if(!select)return;
    let wrap=document.getElementById('soRevenueOtherWrap');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='soRevenueOtherWrap';
      wrap.innerHTML=`<label>Outro valor / faixa de faturamento</label><input id="soRevenueOther" value="${esc(storedOther)}" placeholder="Informe o valor ou a faixa desejada">`;
      select.parentElement?.parentElement?.insertBefore(wrap,select.parentElement?.nextSibling||null);
    }
    const refresh=()=>{wrap.style.display=select.value==='OUTRO VALOR'?'block':'none'};
    select.addEventListener('change',refresh);refresh();
  }

  function previousCountControl(filters){
    if(document.getElementById('soPriorCountBlock'))return;
    const anchor=[...document.querySelectorAll('#spcOrderDialog h3')].find(h=>h.textContent.includes('Atributos que o SPC deve retornar'))||[...document.querySelectorAll('#spcOrderDialog h3')][0];
    if(!anchor)return;
    const based=filters?.prior_count_based===true||String(filters?.prior_count_based)==='true';
    const block=document.createElement('div');
    block.id='soPriorCountBlock';
    block.style.cssText='margin:22px 0;padding:16px;border:1px solid #cfe0f6;background:#f8fbff;border-radius:14px';
    block.innerHTML=`<h3 style="margin-top:0">Contagem anterior</h3><div class="muted" style="margin-bottom:12px">Esta solicitação está baseada em uma contagem realizada anteriormente?</div><div class="formgrid"><div><label>Baseada em contagem anterior?</label><select id="soPriorCount"><option value="nao" ${!based?'selected':''}>Não</option><option value="sim" ${based?'selected':''}>Sim</option></select></div><div id="soPriorRcWrap"><label>Número do RC</label><input id="soPriorRc" value="${esc(filters?.prior_count_rc||'')}" placeholder="Informe o RC da contagem anterior"></div></div>`;
    anchor.parentElement.insertBefore(block,anchor);
    const sel=document.getElementById('soPriorCount'),rcWrap=document.getElementById('soPriorRcWrap');
    const refresh=()=>{rcWrap.style.display=sel.value==='sim'?'block':'none'};sel.addEventListener('change',refresh);refresh();
  }

  async function enhance(orderId){
    const dlg=document.getElementById('spcOrderDialog');if(!dlg)return;
    const {data:o}=await sb.from('spc_data_orders').select('filters,person,product').eq('id',orderId).maybeSingle();if(!o)return;
    const f=o.filters||{};
    previousCountControl(f);
    const market=o.product!=='SPC Enriquece';if(!market)return;

    const state=replaceWithSelect(document.getElementById('soState'),STATES,'Clique aqui para selecionar o estado');
    if(state&&f.state&&STATES.some(x=>norm(x)===norm(f.state)))state.value=STATES.find(x=>norm(x)===norm(f.state))||f.state;
    const city=document.getElementById('soCity');updateCityLabel(city);addCepField(city,f.cep||'');

    if(String(o.person||'').includes('Jurídica')){
      const revenue=replaceWithSelect(document.getElementById('soRevenue'),REVENUE,'Selecione a faixa de faturamento');
      const current=f.revenue||'',official=REVENUE.find(x=>norm(x)===norm(current));
      if(revenue){if(official)revenue.value=official;else if(current)revenue.value='OUTRO VALOR'}
      revenueOtherControl(revenue,f.revenue_other||(!official&&current?current:''));
    }
  }

  function install(){
    if(window.__spcFilterControlsInstalled||typeof window.editSpcOrder!=='function'||typeof window.saveSpcOrder!=='function')return false;
    window.__spcFilterControlsInstalled=true;
    const edit=window.editSpcOrder;
    window.editSpcOrder=async function(id){const r=await edit.apply(this,arguments);await enhance(id);return r};

    const save=window.saveSpcOrder;
    window.saveSpcOrder=async function(id,silent=false){
      const prior=val('soPriorCount')==='sim',priorRc=val('soPriorRc');
      if(prior&&!priorRc){if(!silent)alert('Informe o número do RC da contagem anterior.');return false}
      const stateInput=document.getElementById('soState'),cityInput=document.getElementById('soCity'),cepInput=document.getElementById('soCep');
      const revenue=val('soRevenue'),revenueOther=val('soRevenueOther');
      const ok=await save.apply(this,arguments);if(ok===false)return false;
      const {data:o}=await sb.from('spc_data_orders').select('filters').eq('id',id).maybeSingle();
      const current=o?.filters||{};
      const filters={...current,prior_count_based:prior,prior_count_rc:prior?priorRc:'',state:stateInput?val('soState'):current.state||'',city:cityInput?val('soCity'):current.city||'',cep:cepInput?val('soCep'):current.cep||'',region:'',revenue,revenue_other:revenue==='OUTRO VALOR'?revenueOther:''};
      const {error}=await sb.from('spc_data_orders').update({filters}).eq('id',id);
      if(error){console.error(error);if(!silent)alert('A ordem foi salva, mas houve erro ao atualizar os filtros operacionais.');return false}
      return true;
    };
    return true;
  }

  if(!install()){let n=0;const t=setInterval(()=>{n++;if(install()||n>50)clearInterval(t)},150)}
})();
