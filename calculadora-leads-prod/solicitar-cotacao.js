const sb=window.supabase.createClient(window.CDL_CONFIG.supabaseUrl,window.CDL_CONFIG.supabaseAnonKey);
const C=window.LEAD_CATALOG;

const $=id=>document.getElementById(id);
const els={
  client:$('client'),doc:$('doc'),contact:$('contact'),clientEmail:$('clientEmail'),phone:$('phone'),focus:$('focus'),person:$('person'),qty:$('qty'),objective:$('objective'),notes:$('notes'),
  needMarket:$('needMarket'),needEnrich:$('needEnrich'),solutionArea:$('solutionArea'),solutionTitle:$('solutionTitle'),solutionHelp:$('solutionHelp'),individualGroups:$('individualGroups'),msg:$('msg'),submitBtn:$('submitBtn'),formPanel:$('formPanel'),success:$('success'),requestCode:$('requestCode')
};

let need=null;
let selected=new Set();

function currentProduct(){
  if(need==='market') return 'SPC Mercado';
  if(need==='enrich') return 'SPC Enriquece';
  return null;
}

function chooseNeed(n){
  need=n;
  selected.clear();
  els.needMarket.classList.toggle('active',n==='market');
  els.needEnrich.classList.toggle('active',n==='enrich');
  els.solutionArea.classList.remove('hidden');
  els.solutionTitle.textContent=n==='market'
    ?'Quais dados você gostaria de encontrar no mercado?'
    :'Quais informações você gostaria de acrescentar à sua base?';
  els.solutionHelp.textContent=n==='market'
    ?'Marque as informações que deseja receber sobre os novos contatos ou empresas.'
    :'Marque as informações que deseja complementar ou atualizar nos CPFs ou CNPJs da sua base.';
  renderItems();
  setTimeout(()=>els.solutionArea.scrollIntoView({behavior:'smooth',block:'start'}),50);
}

function resetSelection(){
  selected.clear();
  if(need) renderItems();
}

function selection(){
  const product=currentProduct();
  return [...selected].map(flag=>({product,flag}));
}

function toggleFlag(flag){
  selected.has(flag)?selected.delete(flag):selected.add(flag);
  renderItems();
}

function renderItems(){
  const product=currentProduct();
  if(!product){
    els.solutionArea.classList.add('hidden');
    els.individualGroups.innerHTML='';
    return;
  }
  const p=els.person.value;
  const items=(C?.individual||[]).filter(x=>x.person===p&&x.product===product);
  if(!items.length){
    els.individualGroups.innerHTML='<p class="muted">Não encontramos opções para este perfil. Fale com a CDL para uma cotação personalizada.</p>';
    return;
  }
  els.individualGroups.innerHTML=items.map(x=>`<label class="item"><input type="checkbox" ${selected.has(x.flag)?'checked':''} onchange='toggleFlag(${JSON.stringify(x.flag)})'><span><b>${x.flag}</b><span>${selected.has(x.flag)?'Selecionado':'Clique para incluir'}</span></span></label>`).join('');
}

function clientData(){
  return {
    company:els.client.value.trim(),
    doc:els.doc.value.trim(),
    contact:els.contact.value.trim(),
    email:els.clientEmail.value.trim(),
    phone:els.phone.value.trim(),
    focus:els.focus.value.trim(),
    objective:els.objective.value.trim(),
    need:need==='market'?'dados novos do mercado':'enriquecimento da base'
  };
}

async function submitRequest(){
  els.msg.textContent='';
  const q=Math.max(0,+els.qty.value||0),c=clientData(),sel=selection();
  if(!c.company||!c.contact||!c.email||!q){els.msg.textContent='Preencha empresa, contato, e-mail e quantidade.';return}
  if(!need){els.msg.textContent='Escolha o que você precisa.';return}
  if(!sel.length){els.msg.textContent='Selecione ao menos uma informação.';return}
  els.submitBtn.disabled=true;
  els.submitBtn.textContent='Enviando…';
  const {data,error}=await sb.rpc('submit_lead_quote_request',{p_mode:'individual',p_person:els.person.value,p_qty:q,p_client:c,p_selection:sel,p_notes:els.notes.value.trim()||null});
  els.submitBtn.disabled=false;
  els.submitBtn.textContent='Solicitar cotação';
  if(error){els.msg.textContent='Não foi possível enviar a solicitação. Tente novamente ou fale com a CDL.';console.error(error);return}
  els.requestCode.textContent=data.code;
  els.formPanel.classList.add('hidden');
  els.success.classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

window.chooseNeed=chooseNeed;
window.resetSelection=resetSelection;
window.toggleFlag=toggleFlag;
window.submitRequest=submitRequest;
