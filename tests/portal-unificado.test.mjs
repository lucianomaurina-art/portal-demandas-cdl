// Testes de fumaça: portal unificado CDL.
// Execução: node --test tests/portal-unificado.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../portal-modules.css', import.meta.url), 'utf8');

function landing() {
  const m = html.match(/<section id="inicio" class="view">([\s\S]*?)<\/section>/);
  assert.ok(m, 'Tela inicial deve continuar existindo');
  return m[1];
}

test('rotas e formulários preexistentes permanecem no portal', () => {
  for (const id of ['nova', 'nova-ideia', 'plano', 'dashboard', 'ideias', 'usuarios', 'login']) {
    assert.match(html, new RegExp('id="' + id + '"'), 'Tela ' + id + ' ausente');
  }
  assert.match(html, /<script src="app\.js/);
  assert.match(html, /<script src="ideas\.js/);
  assert.match(html, /<script src="config\.js/);
});

test('quatro cartões e navegação preservada', () => {
  const home = landing();
  assert.match(home, /O que você deseja fazer\?/);
  assert.equal((home.match(/class="entry-card /g) || []).length, 4);
  assert.match(home, /href="#\/nova"/);
  assert.match(home, /href="#\/nova-ideia"/);
  assert.match(home, /Orçamento Base Zero/);
  assert.match(home, /Compras e Contratações/);
});

test('OBZ abre em nova aba com proteção de origem', () => {
  const home = landing();
  assert.match(home, /href="https:\/\/lucianomaurina-art\.github\.io\/cdl-obz-2027-homologacao\/"/);
  assert.match(home, /target="_blank" rel="noopener noreferrer"/);
});

test('Compras tem uma área autenticada no mesmo portal', () => {
  const home = landing();
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(home, /purchases-entry portal-module" href="#\/compras"/);
  assert.match(html, /id="compras" class="view hidden"/);
  assert.match(app, /const protectedViews = .*'compras', 'compras-triagem'/);
  assert.match(app, /if \(!session \|\| !profile\?\.active\)/);
  assert.match(html, /id="purchasePrototypeFrame"/);
  assert.match(app, /if \(id === 'compras'\) openPurchasePrototype\(\)/);
  assert.match(html, /href="#\/compras-triagem">Abrir triagem compartilhada/);
});

test('estilo novo limita-se à tela inicial e tem responsividade', () => {
  assert.match(html, /portal-modules\.css/);
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...rules.matchAll(/([^{}]+)\{/g)]
    .map(x => x[1].trim()).filter(x => !x.startsWith('@media'));
  assert.ok(selectors.length > 10);
  assert.ok(selectors.every(s => s.split(',').every(part => /^#inicio |^\.portal-(switcher|purchase-links)/.test(part.trim()))),
    'O CSS deve estar limitado à home, à navegação e aos atalhos de Compras');
  assert.match(css, /@media\(max-width:880px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
});

test('rotas preservam o destino do login, o módulo atual e a saída de Compras', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const views = Object.fromEntries(['inicio', 'nova', 'nova-ideia', 'login', 'compras', 'compras-triagem']
    .map(id => [id, {classList: new Set(['view'])}]));
  for (const {classList} of Object.values(views)) {
    classList.contains = classList.has;
    classList.remove = classList.delete;
  }
  const links = ['inicio', 'demandas', 'ideias', 'compras'].map(module => ({
    dataset: {module},
    setAttribute() { this.current = true; },
    removeAttribute() { this.current = false; },
  }));
  let activeFrame = false;
  let loadedTriage = false;
  const context = {
    location: {hash: '#/compras-triagem'}, configured: true, session: null, postLoginRoute: null,
    document: {getElementById: id => views[id]},
    $$: selector => selector === '.view' ? Object.values(views) : links,
    openPurchasePrototype() { activeFrame = true; },
    closePurchasePrototype() { activeFrame = false; },
    loadPurchaseModule() { loadedTriage = true; },
  };
  const route = runInNewContext(
    app.slice(app.indexOf('const protectedViews'), app.indexOf('function setAuthUI')) + '\nroute',
    context,
  );
  route();
  assert.equal(context.location.hash, '#/login');
  assert.equal(context.postLoginRoute, '#/compras-triagem');
  route();
  context.session = {};
  context.location.hash = context.postLoginRoute;
  route();
  assert.equal(loadedTriage, true);
  assert.equal(links.find(link => link.current)?.dataset.module, 'compras');
  context.location.hash = '#/compras';
  route();
  assert.equal(activeFrame, true);
  context.location.hash = '#/nova-ideia';
  route();
  assert.equal(activeFrame, false);
  assert.equal(links.find(link => link.current)?.dataset.module, 'ideias');
  context.location.hash = '#/rota-inexistente';
  route();
  assert.equal(links.find(link => link.current)?.dataset.module, 'inicio');
});
