// Navegação SPA: um único endereço, três áreas internas.
window.openSection=async function(section){
  const map={calculator:'calculatorView',requests:'requestsView',proposals:'proposalsView'};
  Object.values(map).forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  document.getElementById(map[section]||map.calculator)?.classList.remove('hidden');
  document.getElementById('navCalc')?.classList.toggle('active',section==='calculator');
  document.getElementById('navRequests')?.classList.toggle('active',section==='requests');
  document.getElementById('navProposals')?.classList.toggle('active',section==='proposals');
  window.scrollTo({top:0,behavior:'smooth'});
  if(section==='requests') await showRequests(true);
  if(section==='proposals') await showHistory(true);
};

// Mantém as funções existentes, mas faz as listas renderizarem nas abas da plataforma.
const _showRequests=window.showRequests;
if(typeof _showRequests==='function'){
  window.showRequests=async function(show=true){
    const old=document.getElementById('requestList');
    const result=await _showRequests(show);
    if(show && old) document.getElementById('requestsView')?.classList.remove('hidden');
    return result;
  };
}
const _showHistory=window.showHistory;
if(typeof _showHistory==='function'){
  window.showHistory=async function(show=true){
    const result=await _showHistory(show);
    if(show) document.getElementById('proposalsView')?.classList.remove('hidden');
    return result;
  };
}
