// Navegação SPA do Portal Comercial: um único endereço e abas internas.
let portalAdminRole=null;
let portalUsersOriginal=new Map();
const PORTAL_SECTORS=['Comercial','Gestão Executiva','Administrativo','Financeiro','Marketing','Relacionamento','Certificação Digital','SPC'];

async function portalLoadRole(){
  if(portalAdminRole!==null)return portalAdminRole;
  const {data:{user}}=await sb.auth.getUser();
  if(!user)return '';
  const {data}=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle();
  portalAdminRole=data?.role||'';
  return portalAdminRole;
}

async function ensureUsersArea(){
  const role=await portalLoadRole();
  const nav=document.querySelector('.mainnav-inner');
  const main=document.querySelector('main.shell');
  if(role!=='admin'){
    document.getElementById('navUsers')?.remove();
    document.getElementById('usersView')?.remove();
    return;
  }
  if(!document.getElementById('navUsers')&&nav){
    nav.insertAdjacentHTML('beforeend','<button id="navUsers" class="navbtn" onclick="openSection(\'users\')">Usuários</button>');
  }
  if(!document.getElementById('usersView')&&main){
    main.insertAdjacentHTML('beforeend',`<section id="usersView" class="hidden"><div class="toprow"><div><div class="eyebrow">Administração</div><h1>Usuários</h1><p class="muted">Gerencie nome, setor, perfil e acesso ao Portal Comercial.</p></div><button id="saveAllUsersTop" class="primary hidden" onclick="saveAllPortalUsers()">Salvar alterações</button></div><div class="panel"><div class="notice">Novos logins continuam sendo criados em Authentication → Users no Supabase. Faça todas as alterações necessárias e salve uma única vez.</div><div id="usersSaveMsg" class="muted" style="margin:0 0 12px"></div><div id="usersList"><p class="muted">Carregando usuários…</p></div><div style="display:flex;justify-content:flex-end;margin-top:18px"><button id="saveAllUsersBottom" class="primary hidden" onclick="saveAllPortalUsers()">Salvar alterações</button></div></div></section>`);
  }
}

window.openSection=async function(section){
  await ensureUsersArea();
  const map={calculator:'calculatorView',requests:'requestsView',proposals:'proposalsView',users:'usersView'};
  Object.values(map).forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  if(section==='users'&&portalAdminRole!=='admin')section='calculator';
  document.getElementById(map[section]||map.calculator)?.classList.remove('hidden');
  document.getElementById('navCalc')?.classList.toggle('active',section==='calculator');
  document.getElementById('navRequests')?.classList.toggle('active',section==='requests');
  document.getElementById('navProposals')?.classList.toggle('active',section==='proposals');
  document.getElementById('navUsers')?.classList.toggle('active',section==='users');
  window.scrollTo({top:0,behavior:'smooth'});
  if(section==='requests')await showRequests(true);
  if(section==='proposals')await showHistory(true);
  if(section==='users')await showUsersAdmin();
};

function escUser(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function normalizeSector(s){
  const v=String(s||'').trim();
  if(!v)return '';
  const known=PORTAL_SECTORS.find(x=>x.toLocaleLowerCase('pt-BR')===v.toLocaleLowerCase('pt-BR'));
  return known||v;
}
function sectorOptions(current){
  const value=normalizeSector(current);
  const values=[...PORTAL_SECTORS];
  if(value&&!values.includes(value))values.push(value);
  return `<option value="">Selecione o setor</option>${values.map(x=>`<option value="${escUser(x)}" ${x===value?'selected':''}>${escUser(x)}</option>`).join('')}`;
}
function readPortalUser(id){
  return {
    id,
    name:(document.getElementById(`uname-${id}`)?.value||'').trim(),
    sector:normalizeSector(document.getElementById(`usector-${id}`)?.value||''),
    role:document.getElementById(`urole-${id}`)?.value||'colaborador',
    active:!!document.getElementById(`uactive-${id}`)?.checked
  };
}
function portalUserChanged(id){
  const a=portalUsersOriginal.get(id),b=readPortalUser(id);
  return !a||a.name!==b.name||normalizeSector(a.sector)!==b.sector||a.role!==b.role||!!a.active!==b.active;
}
window.markPortalUserChanged=function(id){
  const row=document.getElementById(`urow-${id}`);
  const changed=portalUserChanged(id);
  row?.classList.toggle('user-pending',changed);
  const badge=document.getElementById(`upending-${id}`);
  badge?.classList.toggle('hidden',!changed);
  const count=[...portalUsersOriginal.keys()].filter(portalUserChanged).length;
  ['saveAllUsersTop','saveAllUsersBottom'].forEach(x=>document.getElementById(x)?.classList.toggle('hidden',count===0));
  const msg=document.getElementById('usersSaveMsg');
  if(msg)msg.textContent=count?`${count} ${count===1?'alteração pendente':'alterações pendentes'}. Clique em “Salvar alterações” para gravar tudo de uma vez.`:'';
};

window.showUsersAdmin=async function(){
  const box=document.getElementById('usersList');
  if(!box)return;
  box.innerHTML='<p class="muted">Carregando usuários…</p>';
  const {data,error}=await sb.rpc('admin_list_portal_users');
  if(error){console.error(error);box.innerHTML='<p class="muted">A gestão de usuários ainda não está habilitada. Execute a migração 007 no Supabase.</p>';return;}
  const rows=data||[];
  portalUsersOriginal=new Map(rows.map(u=>[u.id,{name:(u.name||'').trim(),sector:normalizeSector(u.sector),role:u.role||'colaborador',active:!!u.active}]));
  const onchange=id=>`oninput="markPortalUserChanged('${id}')" onchange="markPortalUserChanged('${id}')"`;
  box.innerHTML=rows.length?`<style>.user-pending{background:#fff9e8}.pending-badge{display:inline-block;margin-top:5px;padding:3px 7px;border-radius:999px;background:#fff0c2;color:#805b00;font-size:10px;font-weight:800}.users-table td,.users-table th{padding:9px;vertical-align:middle;border-bottom:1px solid #edf1f6;text-align:left}.users-table{width:100%;border-collapse:collapse}.users-table input,.users-table select{min-width:145px}</style><div style="overflow:auto"><table class="users-table"><thead><tr><th>Usuário</th><th>Nome</th><th>Setor</th><th>Perfil</th><th>Ativo</th></tr></thead><tbody>${rows.map(u=>`<tr id="urow-${u.id}"><td><b>${escUser(u.email)}</b><br><span id="upending-${u.id}" class="pending-badge hidden">Alteração pendente</span></td><td><input id="uname-${u.id}" value="${escUser(u.name||'')}" ${onchange(u.id)}></td><td><select id="usector-${u.id}" ${onchange(u.id)}>${sectorOptions(u.sector)}</select></td><td><select id="urole-${u.id}" ${onchange(u.id)}><option value="colaborador" ${u.role==='colaborador'?'selected':''}>Colaborador</option><option value="manager" ${u.role==='manager'?'selected':''}>Manager</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></td><td style="text-align:center"><input id="uactive-${u.id}" type="checkbox" style="width:auto;min-width:0" ${u.active?'checked':''} ${onchange(u.id)}></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Nenhum usuário encontrado.</p>';
  ['saveAllUsersTop','saveAllUsersBottom'].forEach(x=>document.getElementById(x)?.classList.add('hidden'));
  const msg=document.getElementById('usersSaveMsg');if(msg)msg.textContent='';
};

window.saveAllPortalUsers=async function(){
  const ids=[...portalUsersOriginal.keys()].filter(portalUserChanged);
  if(!ids.length)return;
  const buttons=['saveAllUsersTop','saveAllUsersBottom'].map(x=>document.getElementById(x)).filter(Boolean);
  buttons.forEach(b=>{b.disabled=true;b.textContent='Salvando…';});
  let saved=0;
  const errors=[];
  for(const id of ids){
    const u=readPortalUser(id);
    const {error}=await sb.rpc('admin_update_portal_user',{p_user_id:id,p_name:u.name,p_sector:u.sector,p_role:u.role,p_active:u.active});
    if(error){console.error(error);errors.push(id);}else saved++;
  }
  buttons.forEach(b=>{b.disabled=false;b.textContent='Salvar alterações';});
  if(errors.length){alert(`${saved} usuário(s) atualizado(s). ${errors.length} alteração(ões) não puderam ser salvas.`);}
  else alert(`${saved} ${saved===1?'usuário atualizado':'usuários atualizados'} com sucesso.`);
  portalAdminRole=null;
  await portalLoadRole();
  await showUsersAdmin();
};

// Compatibilidade com versões anteriores: salva a linha indicada usando o fluxo atual.
window.savePortalUser=async function(id){markPortalUserChanged(id);await saveAllPortalUsers();};

const _showRequests=window.showRequests;
if(typeof _showRequests==='function'){
  window.showRequests=async function(show=true){const old=document.getElementById('requestList');const result=await _showRequests(show);if(show&&old)document.getElementById('requestsView')?.classList.remove('hidden');return result;};
}
const _showHistory=window.showHistory;
if(typeof _showHistory==='function'){
  window.showHistory=async function(show=true){const result=await _showHistory(show);if(show)document.getElementById('proposalsView')?.classList.remove('hidden');return result;};
}

document.addEventListener('DOMContentLoaded',()=>{setTimeout(ensureUsersArea,300)});
