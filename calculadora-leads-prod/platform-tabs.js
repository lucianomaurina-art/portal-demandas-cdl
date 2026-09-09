// Navegação SPA do Portal Comercial: um único endereço e abas internas.
let portalAdminRole=null;
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
    main.insertAdjacentHTML('beforeend',`<section id="usersView" class="hidden"><div class="toprow"><div><div class="eyebrow">Administração</div><h1>Usuários</h1><p class="muted">Gerencie nome, setor, perfil e acesso ao Portal Comercial.</p></div></div><div class="panel"><div class="notice">Novos logins continuam sendo criados em Authentication → Users no Supabase. Depois disso, configure o perfil por aqui.</div><div id="usersList"><p class="muted">Carregando usuários…</p></div></div></section>`);
  }
}

window.openSection=async function(section){
  await ensureUsersArea();
  const map={calculator:'calculatorView',requests:'requestsView',proposals:'proposalsView',users:'usersView'};
  Object.values(map).forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  const target=map[section]||map.calculator;
  if(section==='users'&&portalAdminRole!=='admin')section='calculator';
  document.getElementById(map[section]||map.calculator)?.classList.remove('hidden');
  document.getElementById('navCalc')?.classList.toggle('active',section==='calculator');
  document.getElementById('navRequests')?.classList.toggle('active',section==='requests');
  document.getElementById('navProposals')?.classList.toggle('active',section==='proposals');
  document.getElementById('navUsers')?.classList.toggle('active',section==='users');
  window.scrollTo({top:0,behavior:'smooth'});
  if(section==='requests') await showRequests(true);
  if(section==='proposals') await showHistory(true);
  if(section==='users') await showUsersAdmin();
};

function escUser(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

window.showUsersAdmin=async function(){
  const box=document.getElementById('usersList');
  if(!box)return;
  box.innerHTML='<p class="muted">Carregando usuários…</p>';
  const {data,error}=await sb.rpc('admin_list_portal_users');
  if(error){
    console.error(error);
    box.innerHTML='<p class="muted">A gestão de usuários ainda não está habilitada. Execute a migração 007 no Supabase.</p>';
    return;
  }
  const rows=data||[];
  box.innerHTML=rows.length?`<div style="overflow:auto"><table class="proposal-table"><thead><tr><th>Usuário</th><th>Nome</th><th>Setor</th><th>Perfil</th><th>Ativo</th><th></th></tr></thead><tbody>${rows.map(u=>`<tr><td><b>${escUser(u.email)}</b></td><td><input id="uname-${u.id}" value="${escUser(u.name||'')}"></td><td><input id="usector-${u.id}" value="${escUser(u.sector||'')}" placeholder="Ex.: Comercial"></td><td><select id="urole-${u.id}"><option value="colaborador" ${u.role==='colaborador'?'selected':''}>Colaborador</option><option value="manager" ${u.role==='manager'?'selected':''}>Manager</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></td><td style="text-align:center"><input id="uactive-${u.id}" type="checkbox" style="width:auto" ${u.active?'checked':''}></td><td><button class="secondary" onclick="savePortalUser('${u.id}')">Salvar</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Nenhum usuário encontrado.</p>';
};

window.savePortalUser=async function(id){
  const name=document.getElementById(`uname-${id}`)?.value||'';
  const sector=document.getElementById(`usector-${id}`)?.value||'';
  const role=document.getElementById(`urole-${id}`)?.value||'colaborador';
  const active=!!document.getElementById(`uactive-${id}`)?.checked;
  const {error}=await sb.rpc('admin_update_portal_user',{p_user_id:id,p_name:name,p_sector:sector,p_role:role,p_active:active});
  if(error){console.error(error);alert('Não foi possível atualizar este usuário.');return}
  alert('Usuário atualizado.');
  if(role==='admin')portalAdminRole='admin';
  await showUsersAdmin();
};

// Mantém as funções existentes, mas faz as listas renderizarem nas abas da plataforma.
const _showRequests=window.showRequests;
if(typeof _showRequests==='function'){
  window.showRequests=async function(show=true){
    const old=document.getElementById('requestList');
    const result=await _showRequests(show);
    if(show&&old)document.getElementById('requestsView')?.classList.remove('hidden');
    return result;
  };
}
const _showHistory=window.showHistory;
if(typeof _showHistory==='function'){
  window.showHistory=async function(show=true){
    const result=await _showHistory(show);
    if(show)document.getElementById('proposalsView')?.classList.remove('hidden');
    return result;
  };
}

document.addEventListener('DOMContentLoaded',()=>{setTimeout(ensureUsersArea,300)});
