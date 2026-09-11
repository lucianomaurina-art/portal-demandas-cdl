const C=window.LEAD_CATALOG||{individual:[]};
const $=id=>document.getElementById(id);
const els={
  client:$('client'),doc:$('doc'),contact:$('contact'),clientEmail:$('clientEmail'),phone:$('phone'),focus:$('focus'),person:$('person'),qty:$('qty'),objective:$('objective'),notes:$('notes'),commercialAcknowledgement:$('commercialAcknowledgement'),
  needMarket:$('needMarket'),needEnrich:$('needEnrich'),solutionArea:$('solutionArea'),solutionTitle:$('solutionTitle'),solutionHelp:$('solutionHelp'),individualGroups:$('individualGroups'),msg:$('msg'),submitBtn:$('submitBtn'),formPanel:$('formPanel'),success:$('success'),requestCode:$('requestCode'),
  existingDataArea:$('existingDataArea'),existingData:$('existingData'),desiredDataTitle:$('desiredDataTitle')
};
let need=null;
let selected=new Set();

const PUBLIC_FLAG_LABELS={
  'Restrição 1 bureau':'Birô de crédito 1 (SPC)',
  'Restrição 2 bureaux':'Birô de crédito 2 (SPC e Serasa)',
  'PEP':'PEP (Pessoa Exposta Politicamente)'
};
const publicFlagLabel=flag=>PUBLIC_FLAG_LABELS[flag]||flag;
const isPJ=()=>els.person?.value==='Pessoa Jurídica';

function ensureCnaeTargetUI(){
  if($('cnaeTargetSection'))return;
  const notesSection=els.notes?.closest('.section');
  if(!notesSection)return;
  const section=document.createElement('div');
  section.id='cnaeTargetSection';
  section.className='section hidden';
  section.innerHTML=`<label>CNAEs ou segmentos desejados *</label><div class="muted" style="margin-bottom:8px">Informe os CNAEs, atividades ou segmentos das empresas que você deseja encontrar. Você pode descrever pelo código, pelo nome da atividade ou pelos dois.</div><textarea id="cnaeSegments" rows="4" placeholder="Ex.: CNAE 4711-3/02 – supermercados; indústrias metalúrgicas; empresas de construção civil."></textarea>`;
  notesSection.parentNode.insertBefore(section,notesSection);
}
function syncPersonRules(){
  ensureCnaeTargetUI();
  $('cnaeTargetSection')?.classList.toggle('hidden',!isPJ());
  if(isPJ()&&need)selected.add('CNAE');
  if(!isPJ())$('cnaeSegments')&&($('cnaeSegments').value='');
}

function currentProduct(){
  if(need==='market') return 'SPC Mercado';
  if(need==='enrich') return 'SPC Enriquece';
  return null;
}

function chooseNeed(n){
  need=n;
  selected.clear();
  if(isPJ())selected.add('CNAE');
  els.needMarket?.classList.toggle('active',n==='market');
  els.needEnrich?.classList.toggle('active',n==='enrich');
  els.solutionArea?.classList.remove('hidden');
  els.existingDataArea?.classList.toggle('hidden',n!=='enrich');
  els.desiredDataTitle?.classList.toggle('hidden',n!=='enrich');
  if(n!=='enrich' && els.existingData) els.existingData.value='';
  if(els.solutionTitle) els.solutionTitle.textContent=n==='market'
    ?'Quais dados você gostaria de encontrar no mercado?'
    :'Vamos entender primeiro a sua base atual.';
  if(els.solutionHelp) els.solutionHelp.textContent=n==='market'
    ?'Marque as informações que deseja receber sobre os novos contatos ou empresas.'
    :'Antes de escolher os dados que quer acrescentar, informe quais dados você já possui hoje.';
  syncPersonRules();
  renderItems();
  setTimeout(()=>els.solutionArea?.scrollIntoView({behavior:'smooth',block:'start'}),50);
}

function resetSelection(){selected.clear();if(isPJ()&&need)selected.add('CNAE');syncPersonRules();if(need)renderItems()}
function selection(){const product=currentProduct();if(isPJ()&&product)selected.add('CNAE');return [...selected].map(flag=>({product,flag}))}
function toggleFlag(flag){if(isPJ()&&flag==='CNAE')return;selected.has(flag)?selected.delete(flag):selected.add(flag);renderItems()}

function renderItems(){
  const product=currentProduct();
  if(!product){els.solutionArea?.classList.add('hidden');if(els.individualGroups)els.individualGroups.innerHTML='';return}
  const p=els.person?.value||'Pessoa Física';
  if(p==='Pessoa Jurídica')selected.add('CNAE');
  const items=(C.individual||[]).filter(x=>x.person===p&&x.product===product);
  if(!els.individualGroups)return;
  if(!items.length){els.individualGroups.innerHTML='<p class="muted">Não encontramos opções para este perfil. Fale com a CDL para uma cotação personalizada.</p>';return}
  els.individualGroups.innerHTML=items.map(x=>{
    const mandatory=p==='Pessoa Jurídica'&&x.flag==='CNAE';
    const checked=selected.has(x.flag)||mandatory;
    return `<label class="item"><input type="checkbox" ${checked?'checked':''} ${mandatory?'disabled':''} data-flag="${String(x.flag).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"/><span><b>${publicFlagLabel(x.flag)}${mandatory?' *':''}</b><span>${mandatory?'Obrigatório para Pessoa Jurídica':(checked?'Selecionado':'Clique para incluir')}</span></span></label>`;
  }).join('');
  els.individualGroups.querySelectorAll('input[data-flag]:not([disabled])').forEach(input=>{
    input.addEventListener('change',()=>toggleFlag(input.dataset.flag));
  });
}

function clientData(){
  return {
    company:els.client?.value.trim()||'',
    doc:els.doc?.value.trim()||'',
    contact:els.contact?.value.trim()||'',
    email:els.clientEmail?.value.trim()||'',
    phone:els.phone?.value.trim()||'',
    focus:els.focus?.value.trim()||'',
    objective:els.objective?.value.trim()||'',
    need:need==='market'?'dados novos do mercado':'enriquecimento da base',
    existing_data:need==='enrich'?(els.existingData?.value.trim()||''):'',
    cnaes_segments:isPJ()?($('cnaeSegments')?.value.trim()||''):'',
    commercial_acknowledgement:true,
    minimum_leads_acknowledged:1000
  };
}

async function getSupabase(){
  if(!window.supabase||!window.CDL_CONFIG?.supabaseUrl||!window.CDL_CONFIG?.supabaseAnonKey) throw new Error('Conexão indisponível');
  return window.supabase.createClient(window.CDL_CONFIG.supabaseUrl,window.CDL_CONFIG.supabaseAnonKey);
}

async function submitRequest(){
  if(els.msg)els.msg.textContent='';
  const q=Math.max(0,+els.qty?.value||0),c=clientData(),sel=selection();
  if(!c.company||!c.contact||!c.email||!q){if(els.msg)els.msg.textContent='Preencha empresa, contato, e-mail e quantidade.';return}
  if(q<1000){if(els.msg)els.msg.textContent='A solicitação mínima para contratação e entrega do SPC Dados é de 1.000 leads.';els.qty?.focus();return}
  if(!need){if(els.msg)els.msg.textContent='Escolha o que você precisa.';return}
  if(need==='enrich'&&!c.existing_data){if(els.msg)els.msg.textContent='Informe quais dados você já possui na sua base.';els.existingData?.focus();return}
  if(isPJ()&&!c.cnaes_segments){if(els.msg)els.msg.textContent='Para Pessoa Jurídica, informe obrigatoriamente quais CNAEs ou segmentos deseja buscar.';$('cnaeSegments')?.focus();return}
  if(!sel.length){if(els.msg)els.msg.textContent='Selecione ao menos uma informação que deseja receber no orçamento.';return}
  if(!els.commercialAcknowledgement?.checked){if(els.msg)els.msg.textContent='Para enviar a solicitação, confirme que está ciente das condições do SPC Dados e da quantidade mínima de 1.000 leads.';els.commercialAcknowledgement?.focus();return}
  if(els.submitBtn){els.submitBtn.disabled=true;els.submitBtn.textContent='Enviando…'}
  try{
    const sb=await getSupabase();
    const {data,error}=await sb.rpc('submit_lead_quote_request',{p_mode:'individual',p_person:els.person.value,p_qty:q,p_client:c,p_selection:sel,p_notes:els.notes?.value.trim()||null});
    if(error)throw error;
    if(els.requestCode)els.requestCode.textContent=data.code;
    els.formPanel?.classList.add('hidden');
    els.success?.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){
    if(els.msg)els.msg.textContent='Não foi possível enviar a solicitação agora. Tente novamente ou fale com a CDL.';
    console.error(error);
  }finally{
    if(els.submitBtn){els.submitBtn.disabled=false;els.submitBtn.textContent='Solicitar cotação'}
  }
}

els.needMarket?.addEventListener('click',()=>chooseNeed('market'));
els.needEnrich?.addEventListener('click',()=>chooseNeed('enrich'));
els.person?.addEventListener('change',resetSelection);
els.submitBtn?.addEventListener('click',submitRequest);

ensureCnaeTargetUI();
syncPersonRules();
window.chooseNeed=chooseNeed;
window.resetSelection=resetSelection;
window.toggleFlag=toggleFlag;
window.submitRequest=submitRequest;
