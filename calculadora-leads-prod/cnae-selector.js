// Seletor operacional de CNAEs — não participa da precificação.
// Catálogo curado a partir da estrutura oficial CNAE 2.0/Subclasses CONCLA/IBGE.
// Nenhum CNAE é pré-selecionado: segmento apenas organiza a busca.
(() => {
  const G=(root,label,items)=>({root,label,items});
  const SEGMENTS={
    'Logística':[
      G('49','Transporte terrestre',[
        ['4930-2/01','Transporte rodoviário de carga, exceto produtos perigosos e mudanças, municipal'],['4930-2/02','Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional'],['4930-2/03','Transporte rodoviário de produtos perigosos'],['4930-2/04','Transporte rodoviário de mudanças']
      ]),
      G('52','Armazenamento e atividades auxiliares dos transportes',[
        ['5211-7/01','Armazéns gerais - emissão de warrant'],['5211-7/02','Guarda-móveis'],['5211-7/99','Depósitos de mercadorias para terceiros, exceto armazéns gerais e guarda-móveis'],['5250-8/04','Organização logística do transporte de carga']
      ]),
      G('53','Correio e outras atividades de entrega',[
        ['5320-2/01','Serviços de malote não realizados pelo Correio Nacional'],['5320-2/02','Serviços de entrega rápida']
      ])
    ],
    'Saúde':[
      G('86','Atividades de atenção à saúde humana',[
        ['8610-1/01','Atividades de atendimento hospitalar, exceto pronto-socorro e unidades para atendimento a urgências'],['8610-1/02','Atividades de atendimento em pronto-socorro e unidades hospitalares para atendimento a urgências'],['8630-5/01','Atividade médica ambulatorial com recursos para realização de procedimentos cirúrgicos'],['8630-5/02','Atividade médica ambulatorial com recursos para realização de exames complementares'],['8630-5/03','Atividade médica ambulatorial restrita a consultas'],['8640-2/02','Laboratórios clínicos'],['8650-0/01','Atividades de enfermagem'],['8650-0/02','Atividades de profissionais da nutrição'],['8650-0/03','Atividades de psicologia e psicanálise'],['8650-0/04','Atividades de fisioterapia'],['8650-0/05','Atividades de terapia ocupacional'],['8650-0/06','Atividades de fonoaudiologia'],['8650-0/99','Atividades de profissionais da área de saúde não especificadas anteriormente']
      ]),
      G('87','Atenção à saúde integrada com assistência social',[]),G('88','Serviços de assistência social sem alojamento',[])
    ],
    'Moda':[
      G('13','Fabricação de produtos têxteis',[]),G('14','Confecção de artigos do vestuário e acessórios',[]),
      G('15','Preparação de couros e fabricação de artefatos de couro, artigos para viagem e calçados',[
        ['1531-9/01','Fabricação de calçados de couro'],['1532-7/00','Fabricação de tênis de qualquer material'],['1533-5/00','Fabricação de calçados de material sintético'],['1539-4/00','Fabricação de calçados de materiais não especificados anteriormente'],['1540-8/00','Fabricação de partes para calçados, de qualquer material']
      ]),
      G('46/47','Comércio de moda — somente atividades relacionadas',[
        ['4642-7/01','Comércio atacadista de artigos do vestuário e acessórios, exceto profissionais e de segurança'],['4643-5/01','Comércio atacadista de calçados'],['4781-4/00','Comércio varejista de artigos do vestuário e acessórios'],['4782-2/01','Comércio varejista de calçados']
      ])
    ],
    'Alimentação':[
      G('10','Fabricação de produtos alimentícios',[
        ['1061-9/01','Beneficiamento de arroz'],['1061-9/02','Fabricação de produtos do arroz'],['1062-7/00','Moagem de trigo e fabricação de derivados'],['1066-0/00','Fabricação de alimentos para animais']
      ]),
      G('11','Fabricação de bebidas',[]),
      G('56','Alimentação',[
        ['5611-2/01','Restaurantes e similares'],['5611-2/03','Lanchonetes, casas de chá, de sucos e similares'],['5620-1/01','Fornecimento de alimentos preparados preponderantemente para empresas'],['5620-1/02','Serviços de alimentação para eventos e recepções - bufê'],['5620-1/04','Fornecimento de alimentos preparados preponderantemente para consumo domiciliar']
      ]),
      G('46/47','Comércio de alimentos e bebidas — somente atividades relacionadas',[])
    ],
    'Tecnologia da Informação — TI':[
      G('62','Atividades dos serviços de tecnologia da informação',[
        ['6201-5/01','Desenvolvimento de programas de computador sob encomenda'],['6202-3/00','Desenvolvimento e licenciamento de programas de computador customizáveis'],['6203-1/00','Desenvolvimento e licenciamento de programas de computador não-customizáveis'],['6204-0/00','Consultoria em tecnologia da informação'],['6209-1/00','Suporte técnico, manutenção e outros serviços em tecnologia da informação']
      ]),
      G('63','Atividades de prestação de serviços de informação',[
        ['6311-9/00','Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet'],['6319-4/00','Portais, provedores de conteúdo e outros serviços de informação na internet']
      ])
    ],
    'Indústria':[
      G('24','Metalurgia',[]),G('25','Fabricação de produtos de metal, exceto máquinas e equipamentos',[]),G('28','Fabricação de máquinas e equipamentos',[]),
      G('01.63','Atividades de pós-colheita', [['0163-6/00','Atividades de pós-colheita']]),
      G('10.6','Moagem, fabricação de produtos amiláceos e de alimentos para animais',[
        ['1061-9/01','Beneficiamento de arroz'],['1061-9/02','Fabricação de produtos do arroz'],['1062-7/00','Moagem de trigo e fabricação de derivados'],['1066-0/00','Fabricação de alimentos para animais']
      ])
    ],
    'Entidades de Classe / Associações':[G('94','Atividades de organizações associativas',[
      ['9411-1/00','Atividades de organizações associativas patronais e empresariais'],['9412-0/00','Atividades de organizações associativas profissionais'],['9499-5/00','Atividades associativas não especificadas anteriormente']
    ])],
    'Serviços':['69','70','71','72','73','74','75','77','78','79','80','81','82','95','96'].map(root=>G(root,'Atividades de serviços — divisão '+root,[])),
    'Outro':[]
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state=new WeakMap();
  function selectedItems(s){return [...s.selected.values()]}
  function allGroups(){const seen=new Map();Object.values(SEGMENTS).flat().forEach(g=>{const k=g.root+'|'+g.label;if(!seen.has(k))seen.set(k,g)});return [...seen.values()]}
  function render(host,s){
    const q=(s.query||'').toLowerCase().trim();
    const groups=(q?allGroups():s.segments.flatMap(x=>(SEGMENTS[x]||[]))).map(g=>({...g,items:(g.items||[]).filter(i=>!q||(`${i[0]} ${i[1]}`).toLowerCase().includes(q))})).filter(g=>!q||g.items.length);
    host.innerHTML=`<div style="border:1px solid #cfe0f6;background:#f8fbff;border-radius:14px;padding:16px;margin-top:18px"><h4 style="margin:0 0 5px;color:#071b33">Público-alvo das empresas</h4><div class="muted">Selecione somente os CNAEs das empresas que deseja encontrar. <b>Nenhum CNAE é pré-marcado</b> e esta seleção <b>não altera o preço dos leads</b>.</div><label style="margin-top:15px">Segmento para facilitar a busca <span class="muted" style="font-weight:500">(opcional)</span></label><div style="display:flex;flex-wrap:wrap;gap:7px">${Object.keys(SEGMENTS).map(x=>`<button type="button" data-seg="${esc(x)}" style="border:1px solid ${s.segments.includes(x)?'#0b62d6':'#dce3ed'};background:${s.segments.includes(x)?'#e8f1ff':'#fff'};color:#142033;border-radius:999px;padding:8px 11px;font-weight:700">${esc(x)}</button>`).join('')}</div><label style="margin-top:15px">Buscar CNAE específico por código ou atividade</label><input data-cnae-search placeholder="Ex.: 4930, transportadora, software, restaurante" value="${esc(s.query||'')}"><div data-cnae-groups style="margin-top:12px">${groups.length?groups.map(g=>`<details style="background:#fff;border:1px solid #dce3ed;border-radius:10px;padding:10px 12px;margin:7px 0" ${q?'open':''}><summary style="cursor:pointer;font-weight:800">${esc(g.root)} — ${esc(g.label)}</summary>${g.items.length?`<div style="display:grid;gap:7px;margin-top:10px">${g.items.map(i=>`<label style="display:flex;gap:8px;align-items:flex-start;margin:0;font-weight:500"><input style="width:auto;margin-top:3px" type="checkbox" data-cnae="${esc(i[0])}" data-root="${esc(g.root)}" data-desc="${esc(i[1])}" ${s.selected.has(i[0])?'checked':''}><span><b>${esc(i[0])}</b> — ${esc(i[1])}</span></label>`).join('')}</div>`:`<div class="muted" style="margin-top:8px;font-size:12px">Ainda não há subclasses deste grupo no catálogo curado. Busque por atividade ou marque que precisa de ajuda da CDL.</div>`}</details>`).join(''):'<div class="muted" style="margin-top:10px">${q?'Nenhum CNAE do catálogo atual corresponde à busca.':'Escolha um segmento, pesquise uma atividade ou marque que precisa de ajuda.'}</div>'}</div><label style="display:flex;gap:9px;align-items:flex-start;margin-top:14px"><input data-cnae-help type="checkbox" style="width:auto;margin-top:3px" ${s.help?'checked':''}><span>Não sei quais CNAEs selecionar — preciso de ajuda da CDL</span></label><div data-help-area style="${s.help?'':'display:none'}"><label>Descreva o público que deseja encontrar</label><textarea data-cnae-free rows="3" placeholder="Ex.: Quero indústrias metalmecânicas de Novo Hamburgo e região.">${esc(s.freeText||'')}</textarea></div><div style="margin-top:13px;padding:11px;background:#fff;border-radius:10px"><b>Resumo:</b> ${selectedItems(s).length} CNAE(s) específico(s) selecionado(s)${s.segments.length?` • filtro de navegação: ${esc(s.segments.join(', '))}`:''}</div></div>`;
    host.querySelectorAll('[data-seg]').forEach(b=>b.onclick=()=>{const x=b.dataset.seg;s.segments=s.segments.includes(x)?s.segments.filter(v=>v!==x):[...s.segments,x];render(host,s)});
    const search=host.querySelector('[data-cnae-search]');search.oninput=e=>{const pos=e.target.selectionStart;s.query=e.target.value;render(host,s);const n=host.querySelector('[data-cnae-search]');n?.focus();try{n?.setSelectionRange(pos,pos)}catch(_){}};
    host.querySelectorAll('[data-cnae]').forEach(i=>i.onchange=()=>{if(i.checked)s.selected.set(i.dataset.cnae,{code:i.dataset.cnae,root:i.dataset.root,description:i.dataset.desc});else s.selected.delete(i.dataset.cnae);render(host,s)});
    host.querySelector('[data-cnae-help]').onchange=e=>{s.help=e.target.checked;render(host,s)};
    const free=host.querySelector('[data-cnae-free]');if(free)free.oninput=e=>s.freeText=e.target.value;
  }
  function mount(host,initial={}){if(!host)return null;const s={segments:[...(initial.segments||[])],selected:new Map((initial.cnaes||[]).map(x=>[x.code,x])),help:!!initial.needs_help,freeText:initial.free_text||'',query:''};state.set(host,s);render(host,s);return {getValue:()=>({segments:[...s.segments],roots:[...new Set(selectedItems(s).map(x=>x.root).filter(Boolean))],cnaes:selectedItems(s),needs_help:s.help,free_text:s.freeText.trim()}),setValue:v=>{s.segments=[...(v?.segments||[])];s.selected=new Map((v?.cnaes||[]).map(x=>[x.code,x]));s.help=!!v?.needs_help;s.freeText=v?.free_text||'';s.query='';render(host,s)},clear:()=>{s.segments=[];s.selected.clear();s.help=false;s.freeText='';s.query='';render(host,s)}}}
  window.CDLCnaeSelector={mount,segments:SEGMENTS};
})();