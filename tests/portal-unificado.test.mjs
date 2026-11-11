// Testes de fumaça: portal unificado CDL.
// Execução: node --test tests/portal-unificado.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  assert.match(app, /'usuarios','compras','compras-triagem'\]\.includes\(id\)/);
  assert.match(app, /if \(!session \|\| !profile\?\.active\)/);
  assert.match(html, /id="purchasePrototypeFrame"/);
  assert.match(app, /if\(id==='compras'\)openPurchasePrototype\(\)/);
});

test('estilo novo limita-se à tela inicial e tem responsividade', () => {
  assert.match(html, /portal-modules\.css/);
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...rules.matchAll(/([^{}]+)\{/g)]
    .map(x => x[1].trim()).filter(x => !x.startsWith('@media'));
  assert.ok(selectors.length > 10);
  assert.ok(selectors.every(s => s.split(',').every(part => part.trim().startsWith('#inicio '))),
    'Novo CSS não deve modificar as telas internas');
  assert.match(css, /@media\(max-width:880px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
});
