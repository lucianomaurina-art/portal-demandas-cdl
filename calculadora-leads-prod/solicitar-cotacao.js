const C=window.LEAD_CATALOG||{individual:[]};
const $=id=>document.getElementById(id);

if(!C.individual.some(x=>x.person==='Pessoa Jurídica'&&x.product==='SPC Mercado'&&x.flag==='Telefone Móvel')){
  const fixedIndex=C.individual.findIndex(x=>x.person==='Pessoa Jurídica'&&x.product==='SPC Mercado'&&x.flag==='Telefone Fixo');
  C.individual.splice(fixedIndex>=0?fixedIndex+1:C.individual.length,0,{person:'Pessoa Jurídica',product:'SPC Mercado',flag:'Telefone Móvel'});
}

const els={
  client:$('client'),doc:$('doc'),contact:$('contact'),clientEmail:$('clientEmail'),phone:$('phone'),
  person:$('person'),qty:$('qty'),objective:$('objective'),notes:$('notes'),
  commercialAcknowledgement:$('commercialAcknowledgement'),needMarket:$('needMarket'),needEnrich:$('needEnrich'),
  solutionArea:$('solutionArea'),solutionTitle:$('solutionTitle'),solutionHelp:$('solutionHelp'),
  individualGroups:$('individualGroups'),msg:$('msg'),submitBtn:$('submitBtn'),formPanel:$('formPanel'),
  success:$('success'),requestCode:$('requestCode'),existingDataArea:$('existingDataArea'),
  existingData:$('existingData'),desiredDataTitle:$('desiredDataTitle'),locationRows:$('locationRows'),addLocation:$('addLocation')
};

let need=null;
let selected=new Set();
const labels={
  'Restrição 1 bureau':'Birô de crédito 1 (SPC)',
  'Restrição 2 bureaux':'Birô de crédito 2 (SPC e Serasa)',
  'PEP':'PEP (Pessoa Exposta Politicamente)'
};
const UFS=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatCep=value=>{
  const digits=String(value||'').replace(/\D/g,'').slice(0,8);
  return digits.length>5?`${digits.slice(0,5)}-${digits.slice(5)}`:digits;
};

function locationRow(location={}){
  const state=String(location.state||'').toUpperCase();
  return `<div class="location-row">
    <div><label>Cidade *</label><input class="location-city" value="${esc(location.city||'')}" placeholder="Ex.: Novo Hamburgo"></div>
    <div><label>UF</label><select class="location-state"><option value="">UF</option>${UFS.map(uf=>`<option ${uf===state?'selected':''}>${uf}</option>`).join('')}</select></div>
    <div><label>CEP (opcional)</label><input class="location-cep" value="${esc(formatCep(location.cep||''))}" inputmode="numeric" placeholder="93510-000"><small class="cep-status">Em branco = cidade inteira</small></div>
    <button type="button" class="location-remove" title="Excluir localidade">×</button>
  </div>`;
}

function addLocation(location={}){els.locationRows.insertAdjacentHTML('beforeend',locationRow(location));}

function readLocations(){
  return [...els.locationRows.querySelectorAll('.location-row')].map(row=>({
    city:row.querySelector('.location-city')?.value.trim()||'',
    state:row.querySelector('.location-state')?.value||'',
    cep:formatCep(row.querySelector('.location-cep')?.value||'')
  })).filter(location=>location.city||location.state||location.cep);
}

async function lookupCep(input){
  const row=input.closest('.location-row');
  const status=row?.querySelector('.cep-status');
  const digits=String(input.value||'').replace(/\D/g,'');
  input.value=formatCep(digits);
  if(!digits){if(status)status.textContent='Em branco = cidade inteira';return;}
  if(digits.length!==8){if(status)status.textContent='Informe os 8 números do CEP';return;}
  if(status)status.textContent='Consultando CEP…';
  try{
    const response=await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if(!response.ok)throw new Error('CEP não localizado');
    const data=await response.json();
    if(data.erro)throw new Error('CEP não localizado');
    row.querySelector('.location-city').value=data.localidade||'';
    row.querySelector('.location-state').value=data.uf||'';
    if(status)status.textContent='Cidade e UF preenchidas pelo CEP';
  }catch(_error){
    if(status)status.textContent='CEP não localizado; informe a cidade manualmente';
  }
}

const isPJ=()=>els.person?.value==='Pessoa Jurídica';
function syncPersonRules(){$('cnaeTargetSection')?.classList.toggle('hidden',!isPJ());}
function product(){return need==='market'?'SPC Mercado':need==='enrich'?'SPC Enriquece':null;}

function chooseNeed(value){
  need=value;
  selected.clear();
  els.needMarket?.classList.toggle('active',value==='market');
  els.needEnrich?.classList.toggle('active',value==='enrich');
  els.solutionArea?.classList.remove('hidden');
  els.existingDataArea?.classList.toggle('hidden',value!=='enrich');
  els.desiredDataTitle?.classList.toggle('hidden',value!=='enrich');
  if(value!=='enrich'&&els.existingData)els.existingData.value='';
  if(els.solutionTitle)els.solutionTitle.textContent=value==='market'?'Quais dados você gostaria de encontrar no mercado?':'Vamos entender primeiro a sua base atual.';
  if(els.solutionHelp)els.solutionHelp.textContent=value==='market'?'Marque as informações que deseja receber.':'Informe primeiro os dados que você já possui.';
  renderItems();
}

function resetSelection(){selected.clear();syncPersonRules();if(need)renderItems();}

function renderItems(){
  const currentProduct=product();
  if(!currentProduct)return;
  const items=(C.individual||[]).filter(x=>x.person===els.person.value&&x.product===currentProduct);
  els.individualGroups.innerHTML=items.map(x=>`<label class="item"><input type="checkbox" data-flag="${esc(x.flag)}" ${selected.has(x.flag)?'checked':''}><span><b>${labels[x.flag]||x.flag}</b><span>${selected.has(x.flag)?'Selecionado':'Clique para incluir'}</span></span></label>`).join('');
  els.individualGroups.querySelectorAll('[data-flag]').forEach(input=>input.onchange=()=>{
    input.checked?selected.add(input.dataset.flag):selected.delete(input.dataset.flag);
    renderItems();
  });
}

function cnaeData(){return isPJ()?(window.__instantCnae?.getValue()||{segments:[],roots:[],cnaes:[],needs_help:false,free_text:''}):null;}
function cnaeLines(target){return (target?.cnaes||[]).map(x=>`${x.code} — ${x.description}${x.selection_type==='root'?' (raiz)':''}`);}

function clientData(){
  const target=cnaeData();
  const locations=readLocations();
  const first=locations[0]||{};
  const focus=locations.map(location=>[location.city,location.state].filter(Boolean).join('/')+(location.cep?` — CEP ${location.cep}`:'')).join('; ');
  return {
    company:els.client.value.trim(),doc:els.doc.value.trim(),contact:els.contact.value.trim(),
    email:els.clientEmail.value.trim(),phone:els.phone.value.trim(),state:first.state||'',cep:first.cep||'',city:first.city||'',
    locations,focus,objective:els.objective.value.trim(),
    need:need==='market'?'dados novos do mercado':'enriquecimento da base',
    existing_data:need==='enrich'?els.existingData.value.trim():'',cnae_target:target,
    cnaes_segments:target?(cnaeLines(target).join('\n')||target.free_text):'',
    commercial_acknowledgement:true,minimum_leads_acknowledged:1000
  };
}

async function submitRequest(){
  els.msg.textContent='';
  const quantity=+els.qty.value||0;
  const client=clientData();
  const selection=[...selected].map(flag=>({product:product(),flag}));
  if(!client.company||!client.contact||!client.email||quantity<1000){els.msg.textContent='Preencha empresa, contato, e-mail e quantidade mínima de 1.000 leads.';return;}
  if(!client.locations.length||client.locations.some(location=>!location.city)){els.msg.textContent='Informe a cidade em todas as localidades adicionadas. O CEP é opcional.';return;}
  if(!need){els.msg.textContent='Escolha o que você precisa.';return;}
  if(need==='enrich'&&!client.existing_data){els.msg.textContent='Informe quais dados você já possui na sua base.';return;}
  if(isPJ()){
    const target=client.cnae_target;
    if(!(target?.cnaes||[]).length&&!target?.needs_help){els.msg.textContent='Selecione os CNAEs ou raízes desejados ou marque que precisa de ajuda da CDL.';return;}
    if(target.needs_help&&!target.free_text){els.msg.textContent='Descreva o público que deseja encontrar.';return;}
  }
  if(!selection.length){els.msg.textContent='Selecione ao menos uma informação que deseja receber.';return;}
  if(!els.commercialAcknowledgement.checked){els.msg.textContent='Confirme que está ciente das condições do SPC Dados.';return;}
  els.submitBtn.disabled=true;
  els.submitBtn.textContent='Enviando…';
  try{
    if(!window.supabase)throw new Error('Supabase ainda não carregou');
    const sb=window.supabase.createClient(window.CDL_CONFIG.supabaseUrl,window.CDL_CONFIG.supabaseAnonKey);
    const {data,error}=await sb.rpc('submit_lead_quote_request',{p_mode:'individual',p_person:els.person.value,p_qty:quantity,p_client:client,p_selection:selection,p_notes:els.notes.value.trim()||null});
    if(error)throw error;
    els.requestCode.textContent=data.code;
    els.formPanel.classList.add('hidden');
    els.success.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){
    console.error(error);
    els.msg.textContent='Não foi possível enviar agora. Aguarde alguns segundos e tente novamente.';
  }finally{
    els.submitBtn.disabled=false;
    els.submitBtn.textContent='Solicitar cotação';
  }
}

els.addLocation?.addEventListener('click',()=>{addLocation();els.locationRows.querySelector('.location-row:last-child .location-city')?.focus();});
els.locationRows?.addEventListener('click',event=>{
  if(!event.target.classList.contains('location-remove'))return;
  const rows=els.locationRows.querySelectorAll('.location-row');
  if(rows.length===1){rows[0].querySelectorAll('input').forEach(input=>input.value='');rows[0].querySelector('.location-state').value='';}
  else event.target.closest('.location-row').remove();
});
els.locationRows?.addEventListener('input',event=>{if(event.target.classList.contains('location-cep'))event.target.value=formatCep(event.target.value);});
els.locationRows?.addEventListener('focusout',event=>{if(event.target.classList.contains('location-cep'))lookupCep(event.target);});
els.needMarket?.addEventListener('click',()=>chooseNeed('market'));
els.needEnrich?.addEventListener('click',()=>chooseNeed('enrich'));
els.person?.addEventListener('change',resetSelection);
els.submitBtn?.addEventListener('click',submitRequest);

addLocation();
syncPersonRules();
