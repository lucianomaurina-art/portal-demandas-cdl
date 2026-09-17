// Documento completo da Ordem SPC: espelha todos os campos operacionais salvos no editor.
(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const br=v=>esc(v).replace(/\n/g,'<br>');
  const fmtDate=v=>{if(!v)return '—';try{return new Date(v).toLocaleDateString('pt-BR')}catch(e){return String(v)}};
  const yes=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
  const normText=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[;,.\s]+/g,' ').trim();
  const same=(a,b)=>yes(a)&&yes(b)&&normText(a)===normText(b);
  const field=(label,value)=>yes(value)?`<div class="field"><span>${esc(label)}</span><b>${br(value)}</b></div>`:'';
  const section=(title,body)=>body?`<section><h2>${esc(title)}</h2>${body}</section>`:'';
  function attrs(o){const arr=Array.isArray(o.requested_fields)?o.requested_fields:[];return arr.length?`<div class="chips">${arr.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:'<div class="empty">Nenhum atributo registrado.</div>'}
  function filters(o){
    const f=o.filters||{};
    const region=f.region||'';
    const city=same(region,f.city)?'':f.city;
    const rows=[
      field('Região / foco',region),field('Estado(s)',f.state),field('CEP / cidade',city),field('Bairros',f.districts),
      field('Data de abertura / critério',f.opening_date),field('Faturamento mensal',f.revenue),field('CNAE / ramo de atividade',f.cnae_text||f.legacy_cnae),
      field('Sexo',f.sex),field('Faixa de idade',f.age),field('Faixa de renda estimada',f.income),field('Profissão / CBO',f.cbo)
    ].join('');
    return rows?`<div class="grid">${rows}</div>`:'<div class="empty">Nenhum filtro adicional informado.</div>';
  }
  function composition(p){
    const items=p?.quote?.items||[];
    const lines=[];
    if(p?.mode==='combo'){
      lines.push(`<li><b>Combo:</b> ${esc(p.selection?.level||'—')}</li>`);
      const adds=p.selection?.addons||[];if(adds.length)lines.push(`<li><b>Adicionais:</b> ${esc(adds.join(', '))}</li>`);
    } else lines.push('<li><b>Modalidade:</b> Dados individuais</li>');
    items.forEach(i=>lines.push(`<li><b>${esc(i.name||'Item')}</b>${Array.isArray(i.details)&&i.details.length?` — ${esc(i.details.join(', '))}`:''}</li>`));
    return `<ul>${lines.join('')}</ul>`;
  }
  function install(){
    if(typeof window.printSpcOrder!=='function'||window.printSpcOrder.__completePrint)return false;
    window.printSpcOrder=async function(id){
      if(typeof window.saveSpcOrder==='function'){const ok=await window.saveSpcOrder(id,true);if(ok===false)return;}
      const {data:o,error}=await sb.from('spc_data_orders').select('*').eq('id',id).single();if(error||!o){alert('Não foi possível carregar a Ordem SPC.');return;}
      const {data:p}=await sb.from('lead_proposals').select('*').eq('id',o.proposal_id).maybeSingle();
      const c=o.client||{},f=o.filters||{},stage=String(o.stage||''),isCount=stage==='Solicitar contagem'||stage==='Validar contagem',title=isCount?'Ordem de Contagem de Dados':'Ordem de Produção de Dados';
      const w=open('','_blank');if(!w){alert('Autorize pop-ups para gerar a ordem.');return;}
      const entity=o.entity||{};
      const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)} ${esc(c.proposal_code||p?.code||'')}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;max-width:980px;margin:auto;padding:34px;color:#142033;background:#fff}h1{font-size:28px;color:#071b33;margin:0}h2{font-size:17px;color:#071b33;margin:26px 0 10px;border-bottom:2px solid #e7ecf2;padding-bottom:7px}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #0b62d6;padding-bottom:18px}.tag{font-size:12px;color:#667085;margin-top:6px}.entity{margin:18px 0;background:#f4f8ff;border:1px solid #bfd4ee;border-radius:12px;padding:14px;line-height:1.55}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.field{border:1px solid #dce3ed;border-radius:10px;padding:11px 12px;min-height:58px}.field span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085;font-weight:700;margin-bottom:5px}.field b{font-size:13px;line-height:1.45}.box{border:1px solid #dce3ed;border-radius:10px;padding:13px;white-space:normal;line-height:1.55}.chips{display:flex;flex-wrap:wrap;gap:7px}.chips span{background:#eef6ff;border:1px solid #bfd4ee;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:700}.empty{color:#667085;font-size:13px}.notice{background:#fff8e8;border:1px solid #efd39a;border-radius:10px;padding:12px;font-size:12px;line-height:1.5}ul{margin:8px 0;padding-left:20px;line-height:1.55}.print{margin-top:24px;border:0;border-radius:10px;background:#0b62d6;color:#fff;font-weight:700;padding:11px 16px}@media(max-width:700px){.grid{grid-template-columns:1fr}}@media print{body{padding:18px}.print{display:none}section,.entity,.field,.box{break-inside:avoid}}</style></head><body>
      <div class="head"><div><h1>${esc(title)}</h1><div class="tag">SPC Dados • CDL Novo Hamburgo</div></div><div style="text-align:right"><b>${esc(c.proposal_code||p?.code||'—')}</b><div class="tag">Etapa: ${esc(stage||'—')}</div></div></div>
      <div class="entity"><b>${esc(entity.company||'Câmara de Dirigentes Lojistas de Novo Hamburgo')}</b><br>Código: ${esc(entity.code||'22097')}<br>Contato: ${esc(entity.contact||'Priscila Cristiane de Oliveira Istan')}<br>E-mail: ${esc(entity.email||'priscila@cdl-nh.com.br')}</div>
      ${section('Identificação do pedido',`<div class="grid">${field('Proposta',c.proposal_code||p?.code)}${field('Finalidade',o.purpose==='producao'?'Produção / Faturamento':'Contagem de dados')}${field('Produto',o.product)}${field('Tipo de pessoa',o.person||p?.person)}${field('Modalidade',p?.mode==='combo'?'Combo':'Individual')}${field('Combo contratado',p?.mode==='combo'?p.selection?.level:'')}${field('Quantidade aprovada',Number(c.quantity||p?.quantity||0).toLocaleString('pt-BR')+' leads')}</div>`)}
      ${section('Cliente',`<div class="grid">${field('Empresa / Razão social',c.company)}${field('CNPJ / CPF',c.doc)}${field('Contato',c.contact)}${field('E-mail',c.email)}${field('Telefone',c.phone)}</div>`)}
      ${section('Composição aprovada na proposta',composition(p))}
      ${section('Atributos que o SPC deve retornar',attrs(o))}
      ${section('Filtros e público-alvo',filters(o))}
      ${yes(f.existing_data)?section('Dados que o cliente já possui',`<div class="box">${br(f.existing_data)}</div>`):''}
      ${yes(o.external_notes)?section('Observações do cliente / solicitação',`<div class="box">${br(o.external_notes)}</div>`):''}
      ${yes(f.proposal_notes)?section('Informações adicionais da proposta',`<div class="box">${br(f.proposal_notes)}</div>`):''}
      ${yes(o.internal_notes)?section('Informações adicionais internas',`<div class="notice">Uso interno CDL.<br><br>${br(o.internal_notes)}</div>`):''}
      ${section('Contagem SPC',`<div class="grid">${field('Data da solicitação',fmtDate(o.count_requested_at))}${field('Referência da contagem',o.count_reference)}${field('Quantidade encontrada',o.count_result===null||o.count_result===undefined?'':Number(o.count_result).toLocaleString('pt-BR'))}${field('Data de retorno',fmtDate(o.count_returned_at))}${field('Data de validação',fmtDate(o.count_validated_at))}</div>${yes(o.count_notes)?`<div class="box" style="margin-top:10px"><b>Observações da contagem</b><br>${br(o.count_notes)}</div>`:''}`)}
      ${yes(o.production_notes)||yes(o.production_requested_at)?section('Produção / faturamento',`<div class="grid">${field('Data da solicitação de produção',fmtDate(o.production_requested_at))}</div>${yes(o.production_notes)?`<div class="box" style="margin-top:10px"><b>Orientações para produção / faturamento</b><br>${br(o.production_notes)}</div>`:''}`):''}
      <button class="print" onclick="print()">Imprimir / salvar PDF</button></body></html>`;
      w.document.open();w.document.write(html);w.document.close();
    };
    window.printSpcOrder.__completePrint=true;return true;
  }
  if(!install()){let n=0;const t=setInterval(()=>{n++;if(install()||n>40)clearInterval(t)},150)}
})();