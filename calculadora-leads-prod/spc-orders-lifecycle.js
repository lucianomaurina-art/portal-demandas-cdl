// Ciclo complementar das Ordens SPC: planilha Excel, protocolo no envio, inativação e pós-venda.
(() => {
  const escLife=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stageRank=stage=>['Solicitar contagem','Contagem enviada ao SPC','Validar contagem','Aguardando planilha de dados','Dados enviados ao cliente','Pós-venda'].indexOf(stage);
  const localDateTime=value=>{if(!value)return '';const d=new Date(value),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const download=(name,data,type)=>{const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const excelJs=()=>window.ExcelJS?Promise.resolve(window.ExcelJS):(window.__spcExcelJsPromise||(window.__spcExcelJsPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.crossOrigin='anonymous';s.onload=()=>window.ExcelJS?resolve(window.ExcelJS):reject(new Error('ExcelJS não carregou'));s.onerror=()=>reject(new Error('Falha ao carregar ExcelJS'));document.head.appendChild(s)})));
  const display=value=>{if(value===null||value===undefined||value==='')return '—';if(Array.isArray(value))return value.length?value.map(display).filter(x=>x!=='—').join('\n'):'—';if(typeof value==='object')return Object.values(value).filter(Boolean).join(' / ')||'—';return String(value).trim()||'—'};
  const admin=()=>typeof isAdmin==='function'&&isAdmin();

  function currentDialogStage(){return document.getElementById('soStage')?.value||'Solicitar contagem'}
  function syncLifecycleUi(){
    const stage=currentDialogStage(),ticketBox=document.querySelector('#spcOrderDialog .spc-ticket-box'),returnSection=document.getElementById('soCountReturnSection'),purpose=document.getElementById('soPurpose');
    ticketBox?.classList.toggle('hidden',stageRank(stage)<stageRank('Contagem enviada ao SPC'));
    returnSection?.classList.toggle('hidden',stageRank(stage)<stageRank('Validar contagem'));
    if(purpose&&stageRank(stage)>=stageRank('Aguardando planilha de dados'))purpose.value='producao';
    const sent=document.getElementById('soCountSentAt');if(sent&&stageRank(stage)>=stageRank('Contagem enviada ao SPC')&&!sent.value)sent.value=localDateTime(new Date());
  }

  async function enhanceDialog(id){
    const d=document.getElementById('spcOrderDialog');if(!d)return;
    const {data:o}=await sb.from('spc_data_orders').select('*').eq('id',id).maybeSingle();if(!o)return;
    const effective=o.filters?.post_sale===true?'Pós-venda':o.stage,select=document.getElementById('soStage');
    if(select&&!select.querySelector('option[value="Pós-venda"]'))select.insertAdjacentHTML('beforeend','<option value="Pós-venda">Pós-venda</option>');
    if(select){select.value=effective;select.addEventListener('change',syncLifecycleUi)}
    const ticketBox=d.querySelector('.spc-ticket-box'),disabled=ticketBox?.querySelector('input[disabled]');
    if(disabled){const input=document.createElement('input');input.id='soCountSentAt';input.type='datetime-local';input.value=localDateTime(o.count_sent_at);disabled.replaceWith(input);const label=input.closest('div')?.querySelector('label');if(label)label.textContent='Enviado ao SPC em'}
    const actions=d.querySelector('.actions');
    if(actions){const print=[...actions.querySelectorAll('button')].find(b=>/Gerar documento SPC/i.test(b.textContent));if(print){print.textContent='Exportar planilha Excel';print.className='primary';print.setAttribute('onclick',`exportSpcOrderExcel('${id}')`)}if(admin()&&!actions.querySelector('[data-inactivate-spc]'))actions.insertAdjacentHTML('afterbegin',`<button type="button" class="danger" data-inactivate-spc onclick="inactivateSpcOrder('${id}')">Inativar ordem</button>`)}
    syncLifecycleUi();
  }

  window.prepareSpcOrderStage=async(id,stage)=>{await window.editSpcOrder?.(id);const select=document.getElementById('soStage');if(select){select.value=stage;syncLifecycleUi()}if(stage==='Contagem enviada ao SPC')document.getElementById('soSpcTicket')?.focus()};

  window.exportSpcOrderExcel=async id=>{
    if(!await window.saveSpcOrder(id,true))return;
    const [{data:o,error},{data:p}]=await Promise.all([sb.from('spc_data_orders').select('*').eq('id',id).single(),sb.from('spc_data_orders').select('proposal_id').eq('id',id).single().then(async r=>r.data?.proposal_id?sb.from('lead_proposals').select('*').eq('id',r.data.proposal_id).maybeSingle():({data:null}))]);
    if(error||!o)return alert('Não foi possível preparar a planilha da Ordem SPC.');
    let ExcelJS;try{ExcelJS=await excelJs()}catch(e){console.error(e);return alert('Não foi possível carregar o gerador da planilha. Verifique sua conexão e tente novamente.')}
    const c=o.client||{},f=o.filters||{},locations=Array.isArray(f.locations)?f.locations:[],code=c.proposal_code||p?.code||'Ordem SPC';
    const sections=[
      ['IDENTIFICAÇÃO DA ORDEM',[
        ['Proposta',code],['Finalidade',o.purpose==='producao'?'Produção / Faturamento':'Contagem de dados'],['Produto',o.product],['Tipo de pessoa',o.person||p?.person],['Modalidade',p?.mode==='combo'?'Combo':'Individual'],['Combo contratado',p?.mode==='combo'?p.selection?.level:''],['Quantidade aprovada',c.quantity||p?.quantity],['Gerado em',new Date().toLocaleString('pt-BR')]
      ]],
      ['DADOS DO CLIENTE',[
        ['Cliente / Razão social',c.company],['CNPJ / CPF',c.doc],['Contato',c.contact],['E-mail',c.email],['Telefone',c.phone]
      ]],
      ['SEGMENTAÇÃO E FILTROS',[
        ['Cidades / UF / CEP',locations.map(x=>[x.city,x.state,x.cep].filter(Boolean).join(' / '))],['Bairros',f.districts],['Data de abertura / critério',f.opening_date],['Faturamento mensal',f.revenue],['Sexo',f.sex],['Faixa de idade',f.age],['Faixa de renda estimada',f.income],['Profissão / CBO',f.cbo],['CNAE / Ramo de atividade',f.cnae_text]
      ]],
      ['DADOS E ATRIBUTOS SOLICITADOS',[
        ['Atributos solicitados',(o.requested_fields||[]).map(x=>`• ${x}`)]
      ]],
      ['OBSERVAÇÕES',[
        ['Observações do cliente',o.external_notes||f.client_notes],['Informações adicionais da proposta',f.proposal_notes],['Informações internas',o.internal_notes]
      ]]
    ];
    const workbook=new ExcelJS.Workbook();workbook.creator='CDL Novo Hamburgo';workbook.created=new Date();workbook.subject='Ordem SPC Dados';
    const sheet=workbook.addWorksheet('Ordem SPC',{views:[{showGridLines:false}],pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.3,right:.3,top:.55,bottom:.55,header:.2,footer:.2}}});
    sheet.columns=[{key:'field',width:27},{key:'value',width:65}];
    sheet.mergeCells('A1:B1');const title=sheet.getCell('A1');title.value='ORDEM SPC DADOS';title.font={name:'Arial',size:16,bold:true,color:{argb:'FFFFFFFF'}};title.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B62D6'}};title.alignment={horizontal:'center',vertical:'middle'};sheet.getRow(1).height=32;
    sheet.mergeCells('A2:B2');const subtitle=sheet.getCell('A2');subtitle.value=`CDL Novo Hamburgo • ${code}`;subtitle.font={name:'Arial',size:11,bold:true,color:{argb:'FF24496F'}};subtitle.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF3FF'}};subtitle.alignment={horizontal:'center',vertical:'middle'};sheet.getRow(2).height=24;
    sheet.addRow([]);
    const border={top:{style:'thin',color:{argb:'FFD7E0EA'}},left:{style:'thin',color:{argb:'FFD7E0EA'}},bottom:{style:'thin',color:{argb:'FFD7E0EA'}},right:{style:'thin',color:{argb:'FFD7E0EA'}}};
    sections.forEach(([heading,fields])=>{
      const section=sheet.addRow([heading]);sheet.mergeCells(`A${section.number}:B${section.number}`);section.height=24;const cell=section.getCell(1);cell.font={name:'Arial',size:11,bold:true,color:{argb:'FF0B3A6E'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFDCEBFA'}};cell.alignment={vertical:'middle'};
      fields.forEach(([label,raw],index)=>{const value=display(raw),row=sheet.addRow([label,value]),estimatedLines=value.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/62)),0);row.height=Math.min(150,Math.max(22,estimatedLines*15));const labelCell=row.getCell(1),valueCell=row.getCell(2);labelCell.font={name:'Arial',size:10,bold:true,color:{argb:'FF344054'}};valueCell.font={name:'Arial',size:10,color:{argb:'FF1D2939'}};labelCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index%2?'FFF9FBFD':'FFF4F7FB'}};valueCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index%2?'FFFFFFFF':'FFFCFDFE'}};[labelCell,valueCell].forEach(x=>{x.border=border;x.alignment={vertical:'top',wrapText:true}})});
      sheet.addRow([]).height=8;
    });
    sheet.pageSetup.printArea=`A1:B${sheet.rowCount}`;sheet.headerFooter.oddFooter='&L CDL Novo Hamburgo&R Página &P de &N';sheet.properties.defaultRowHeight=20;
    const buffer=await workbook.xlsx.writeBuffer(),safe=String(code||'ordem-spc').replace(/[^a-z0-9_-]+/gi,'-');download(`${safe}-ordem-spc.xlsx`,buffer,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  // Mantém compatibilidade com atalhos antigos do portal.
  window.exportSpcOrderCsv=window.exportSpcOrderExcel;

  window.inactivateSpcOrder=async id=>{
    if(typeof loadCurrentRole==='function')await loadCurrentRole();if(!admin())return alert('A inativação de Ordens SPC é exclusiva do administrador.');
    const {data:o}=await sb.from('spc_data_orders').select('client').eq('id',id).maybeSingle(),code=o?.client?.proposal_code||'esta ordem';if(!confirm(`Inativar ${code}? Ela deixará de aparecer no Kanban de Ordens SPC.`))return;
    let result=await sb.rpc('admin_set_spc_order_active',{p_order_id:id,p_active:false});
    if(result.error&&/function|schema cache|does not exist/i.test(String(result.error.message||'')))result=await sb.from('spc_data_orders').update({active:false}).eq('id',id);
    if(result.error){console.error(result.error);return alert('Não foi possível inativar a Ordem SPC.')}
    document.getElementById('spcOrderDialog')?.close();await window.renderSpcSlaKanban?.();
  };

  function install(){
    if(window.__spcLifecycleInstalled||typeof window.editSpcOrder!=='function'||typeof window.saveSpcOrder!=='function')return false;window.__spcLifecycleInstalled=true;
    const edit=window.editSpcOrder;window.editSpcOrder=async function(id){const out=await edit.apply(this,arguments);await enhanceDialog(id);return out};
    const save=window.saveSpcOrder;window.saveSpcOrder=async function(id,silent=false){const selected=currentDialogStage(),ticket=document.getElementById('soSpcTicket')?.value.trim()||'',sent=document.getElementById('soCountSentAt')?.value||'';if(stageRank(selected)>=stageRank('Contagem enviada ao SPC')&&(!ticket||!sent)){if(!silent)alert('Informe o número do chamado/protocolo e a data de envio ao SPC.');return false}const virtualPostSale=selected==='Pós-venda',stageSelect=document.getElementById('soStage');if(virtualPostSale&&stageSelect)stageSelect.value='Dados enviados ao cliente';const ok=await save.apply(this,arguments);if(stageSelect)stageSelect.value=selected;if(ok===false)return false;const {data:o}=await sb.from('spc_data_orders').select('filters').eq('id',id).maybeSingle(),filters={...(o?.filters||{}),post_sale:virtualPostSale,post_sale_started_at:virtualPostSale?(o?.filters?.post_sale_started_at||new Date().toISOString()):null},payload={filters};if(sent)payload.count_sent_at=new Date(sent).toISOString();const {error}=await sb.from('spc_data_orders').update(payload).eq('id',id);if(error){console.error(error);if(!silent)alert('A ordem foi salva, mas não foi possível concluir os dados complementares.');return false}if(!silent)setTimeout(()=>window.renderSpcSlaKanban?.(),100);return true};
    return true;
  }
  if(!install()){let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer)},150)}
})();
