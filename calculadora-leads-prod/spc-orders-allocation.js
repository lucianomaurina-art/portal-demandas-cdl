// Detalhamento da contagem e distribuição dos leads por cidade/CNAE.
(()=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number=value=>Math.max(0,Math.floor(Number(value)||0));
  const stageRank=stage=>['Solicitar contagem','Contagem enviada ao SPC','Validar contagem','Aguardando planilha de dados','Dados enviados ao cliente','Pós-venda'].indexOf(stage);

  function rowHtml(row={},isPJ=false){
    return `<div class="spc-count-row">
      <div><label>Cidade</label><input class="spc-count-city" value="${esc(row.city||'')}" placeholder="Cidade"></div>
      <div><label>UF</label><input class="spc-count-state" value="${esc(row.state||'')}" maxlength="2" placeholder="RS"></div>
      <div><label>CEP</label><input class="spc-count-cep" value="${esc(row.cep||'')}" placeholder="Opcional"></div>
      ${isPJ?`<div><label>CNAE</label><input class="spc-count-cnae" value="${esc(row.cnae||'')}" placeholder="Código ou atividade"></div>`:''}
      <div><label>Disponível</label><input class="spc-count-available" type="number" min="0" step="1" value="${number(row.available)}" oninput="refreshSpcAllocation()"></div>
      <div><label>Produzir</label><input class="spc-count-allocated" type="number" min="0" step="1" value="${number(row.allocated)}" oninput="refreshSpcAllocation()"></div>
      <button type="button" class="ghost spc-count-remove" onclick="removeSpcCountRow(this)" title="Excluir resultado">×</button>
    </div>`;
  }

  function block(){return document.getElementById('spcAllocationBlock')}
  function readRows(){
    return [...document.querySelectorAll('#spcCountRows .spc-count-row')].map(row=>({
      city:row.querySelector('.spc-count-city')?.value.trim()||'',
      state:(row.querySelector('.spc-count-state')?.value.trim()||'').toUpperCase().slice(0,2),
      cep:row.querySelector('.spc-count-cep')?.value.trim()||'',
      cnae:row.querySelector('.spc-count-cnae')?.value.trim()||'',
      available:number(row.querySelector('.spc-count-available')?.value),
      allocated:number(row.querySelector('.spc-count-allocated')?.value)
    }));
  }

  function proportional(capacities,target){
    const total=capacities.reduce((sum,value)=>sum+value,0),limit=Math.min(number(target),total);
    if(!total||!limit)return capacities.map(()=>0);
    const raw=capacities.map(value=>value/total*limit),out=raw.map((value,index)=>Math.min(capacities[index],Math.floor(value)));
    let remaining=limit-out.reduce((sum,value)=>sum+value,0);
    const order=raw.map((value,index)=>({index,fraction:value-Math.floor(value)})).sort((a,b)=>b.fraction-a.fraction);
    while(remaining>0){let changed=false;for(const item of order){if(remaining<=0)break;if(out[item.index]<capacities[item.index]){out[item.index]++;remaining--;changed=true}}if(!changed)break}
    return out;
  }

  function uniform(capacities,target){
    const total=capacities.reduce((sum,value)=>sum+value,0),limit=Math.min(number(target),total),out=capacities.map(()=>0);let remaining=limit;
    while(remaining>0){const active=capacities.map((capacity,index)=>({capacity,index})).filter(item=>out[item.index]<item.capacity);if(!active.length)break;const share=Math.max(1,Math.floor(remaining/active.length));let changed=false;for(const item of active){if(remaining<=0)break;const give=Math.min(item.capacity-out[item.index],share,remaining);if(give>0){out[item.index]+=give;remaining-=give;changed=true}}if(!changed)break}
    return out;
  }

  window.refreshSpcAllocation=()=>{
    const host=block();if(!host)return;
    const rows=readRows(),contracted=number(host.dataset.contracted),available=rows.reduce((sum,row)=>sum+row.available,0),allocated=rows.reduce((sum,row)=>sum+row.allocated,0),pending=contracted-allocated,method=document.getElementById('soDistributionMethod')?.value||'proportional';
    document.querySelectorAll('.spc-count-allocated').forEach(input=>{input.readOnly=method!=='custom';input.style.background=method==='custom'?'#fff':'#f4f7fb'});
    const count=document.getElementById('soCount');if(count)count.value=available;
    const put=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=Number(value).toLocaleString('pt-BR')};
    put('spcAllocationContracted',contracted);put('spcAllocationAvailable',available);put('spcAllocationAllocated',allocated);put('spcAllocationPending',Math.abs(pending));
    const status=document.getElementById('spcAllocationStatus');if(status){if(allocated===contracted)status.innerHTML='<b style="color:#157f62">Distribuição fechada e pronta para produção.</b>';else if(allocated<contracted)status.innerHTML=`<b style="color:#b54708">Faltam ${Math.abs(pending).toLocaleString('pt-BR')} leads para distribuir.</b>`;else status.innerHTML=`<b style="color:#b42318">A distribuição excede o contratado em ${Math.abs(pending).toLocaleString('pt-BR')} leads.</b>`}
  };

  window.calculateSpcAllocation=()=>{
    const host=block();if(!host)return;const method=document.getElementById('soDistributionMethod')?.value||'proportional';if(method==='custom')return window.refreshSpcAllocation();
    const inputs=[...document.querySelectorAll('.spc-count-available')],capacities=inputs.map(input=>number(input.value)),target=number(host.dataset.contracted),allocation=method==='uniform'?uniform(capacities,target):proportional(capacities,target);
    document.querySelectorAll('.spc-count-allocated').forEach((input,index)=>input.value=allocation[index]||0);window.refreshSpcAllocation();
  };

  window.addSpcCountRow=(row={})=>{const host=document.getElementById('spcCountRows'),isPJ=block()?.dataset.pj==='true';if(!host)return;host.insertAdjacentHTML('beforeend',rowHtml(row,isPJ));host.lastElementChild?.querySelector('.spc-count-city')?.focus();window.refreshSpcAllocation()};
  window.removeSpcCountRow=button=>{const rows=document.querySelectorAll('#spcCountRows .spc-count-row');if(rows.length<=1){button.closest('.spc-count-row')?.querySelectorAll('input').forEach(input=>input.value=input.type==='number'?0:'');window.refreshSpcAllocation();return}button.closest('.spc-count-row')?.remove();window.refreshSpcAllocation()};

  async function enhance(id){
    const section=document.getElementById('soCountReturnSection');if(!section||block())return;
    const {data:order}=await sb.from('spc_data_orders').select('filters,person,client').eq('id',id).maybeSingle();if(!order)return;
    const filters=order.filters||{},isPJ=String(order.person||'').includes('Jurídica'),saved=Array.isArray(filters.count_breakdown)?filters.count_breakdown:[],locations=Array.isArray(filters.locations)?filters.locations:[];
    const initial=saved.length?saved:(locations.length?locations.map(location=>({...location,cnae:'',available:0,allocated:0})):[{city:'',state:'',cep:'',cnae:'',available:0,allocated:0}]);
    const html=`<div id="spcAllocationBlock" data-pj="${isPJ}" data-contracted="${number(order.client?.quantity)}">
      <style>.spc-allocation{margin:18px 0;padding:17px;border:1px solid #bfd4ee;background:#f8fbff;border-radius:14px}.spc-allocation-head{display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap}.spc-count-row{display:grid;grid-template-columns:minmax(150px,1.25fr) 65px 125px ${isPJ?'minmax(150px,1.1fr) ':''}105px 105px 42px;gap:8px;align-items:end;padding:10px 0;border-top:1px solid #dce6f1}.spc-count-row label{margin:0 0 5px;font-size:11px}.spc-count-row input{padding:9px}.spc-count-remove{padding:9px 11px;color:#b42318}.spc-allocation-summary{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:9px;margin:14px 0}.spc-allocation-metric{background:#fff;border:1px solid #dce3ed;border-radius:10px;padding:11px}.spc-allocation-metric span{display:block;color:#667085;font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:5px}.spc-allocation-metric b{font-size:18px}.spc-allocation-controls{display:flex;gap:9px;align-items:end;flex-wrap:wrap}.spc-allocation-controls>div{min-width:260px;flex:1}@media(max-width:850px){.spc-count-row{grid-template-columns:1fr 70px}.spc-count-row>div:nth-child(n+3){grid-column:span 1}.spc-allocation-summary{grid-template-columns:1fr 1fr}}</style>
      <div class="spc-allocation"><div class="spc-allocation-head"><div><h3 style="margin:0">Detalhamento da contagem e distribuição</h3><div class="muted" style="font-size:12px;margin-top:5px">Registre o retorno do SPC por ${isPJ?'cidade e CNAE':'cidade'}. O total encontrado será calculado automaticamente.</div></div><button type="button" class="secondary" onclick="addSpcCountRow()">+ Adicionar resultado</button></div>
      <div id="spcCountRows" style="margin-top:12px">${initial.map(row=>rowHtml(row,isPJ)).join('')}</div>
      <div class="spc-allocation-summary"><div class="spc-allocation-metric"><span>Contratado</span><b id="spcAllocationContracted">0</b></div><div class="spc-allocation-metric"><span>Disponível</span><b id="spcAllocationAvailable">0</b></div><div class="spc-allocation-metric"><span>Distribuído</span><b id="spcAllocationAllocated">0</b></div><div class="spc-allocation-metric"><span>Diferença</span><b id="spcAllocationPending">0</b></div></div>
      <div class="spc-allocation-controls"><div><label>Critério de distribuição</label><select id="soDistributionMethod" onchange="refreshSpcAllocation()"><option value="proportional" ${filters.distribution_method!=='uniform'&&filters.distribution_method!=='custom'?'selected':''}>Proporcional à disponibilidade</option><option value="uniform" ${filters.distribution_method==='uniform'?'selected':''}>Uniforme entre cidade/CNAE</option><option value="custom" ${filters.distribution_method==='custom'?'selected':''}>Personalizada</option></select></div><button type="button" class="primary" onclick="calculateSpcAllocation()">Calcular distribuição</button></div><div id="spcAllocationStatus" style="margin-top:12px"></div></div></div>`;
    const notice=section.querySelector('.notice');if(notice)notice.insertAdjacentHTML('afterend',html);else section.insertAdjacentHTML('beforeend',html);
    const count=document.getElementById('soCount');if(count){count.readOnly=true;count.style.background='#f4f7fb';const label=count.closest('div')?.querySelector('label');if(label)label.textContent='Quantidade total encontrada (automática)'}
    window.refreshSpcAllocation();
  }

  function validateForProduction(stage,silent){
    if(stageRank(stage)<stageRank('Aguardando planilha de dados'))return true;
    const host=block(),rows=readRows(),isPJ=host?.dataset.pj==='true',contracted=number(host?.dataset.contracted),available=rows.reduce((sum,row)=>sum+row.available,0),allocated=rows.reduce((sum,row)=>sum+row.allocated,0);
    let message='';if(!rows.length||rows.some(row=>!row.city))message='Informe a cidade em todas as linhas da contagem.';else if(isPJ&&rows.some(row=>!row.cnae))message='Informe o CNAE em todas as linhas da contagem de pessoa jurídica.';else if(!available)message='Informe a quantidade disponível retornada pelo SPC.';else if(rows.some(row=>row.allocated>row.available))message='Nenhuma linha pode produzir mais leads do que a quantidade disponível.';else if(allocated!==contracted)message=`A distribuição precisa totalizar ${contracted.toLocaleString('pt-BR')} leads. Atualmente totaliza ${allocated.toLocaleString('pt-BR')}.`;
    if(message){alert(message);return false}return true;
  }

  function install(){
    if(window.__spcAllocationInstalled||typeof window.editSpcOrder!=='function'||typeof window.saveSpcOrder!=='function')return false;window.__spcAllocationInstalled=true;
    const edit=window.editSpcOrder;window.editSpcOrder=async function(id){const result=await edit.apply(this,arguments);await enhance(id);return result};
    const save=window.saveSpcOrder;window.saveSpcOrder=async function(id,silent=false){const stage=document.getElementById('soStage')?.value||'',host=block(),rows=host?readRows():[],method=document.getElementById('soDistributionMethod')?.value||'proportional',total=rows.reduce((sum,row)=>sum+row.available,0);if(host&&!validateForProduction(stage,silent))return false;const result=await save.apply(this,arguments);if(result===false)return false;if(host){const {data:order}=await sb.from('spc_data_orders').select('filters').eq('id',id).maybeSingle(),filters={...(order?.filters||{}),count_breakdown:rows,distribution_method:method};const update=await sb.from('spc_data_orders').update({filters,count_result:total}).eq('id',id);if(update.error){console.error(update.error);if(!silent)alert('A ordem foi salva, mas houve erro ao registrar a distribuição.');return false}}return result};
    return true;
  }
  if(!install()){let attempts=0;const timer=setInterval(()=>{attempts++;if(install()||attempts>80)clearInterval(timer)},150)}
})();
