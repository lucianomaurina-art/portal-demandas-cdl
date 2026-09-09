// A calculadora individual deve iniciar sem nenhum produto adicionado.
syncProducts=function(){
  const valid=productsForPerson();
  activeProducts=activeProducts.filter(p=>valid.includes(p));
};

// Corrige também a primeira renderização já feita pelo app.js durante o boot.
if(mode==='individual'){
  activeProducts=[];
  selected.clear();
  quote=null;
  internalQuote=null;
  renderIndividual();
  renderQuote(null);
}
