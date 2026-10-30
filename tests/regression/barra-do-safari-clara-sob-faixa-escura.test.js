// Bug original (iPhone, Safari 26): a faixa escura das marcas terminava em cima de uma barra de baixo clara, "branca,
// estranha", porque o Safari pinta a barra com a cor do fundo da página (claro) e ignora o theme-color. Ele usa a cor
// de um elemento fixo encostado na borda de baixo: enquanto a faixa escura está embaixo da tela, entra um elemento
// fixo escuro (#barra-escura, só no iOS); depois do topo ele sai e a barra volta à cor da página.
// O emulador não desenha a barra do Safari: o teste confere a regra do iOS e quando o elemento liga e desliga.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

test("regra do iOS: elemento fixo escuro encostado na borda de baixo", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(servidor.url);
  const regra = await page.evaluate(() => {
    let base = null, ativa = null;
    for (const folha of document.styleSheets) {
      try {
        const lista = [...folha.cssRules];
        const sup = lista.filter((r) => r.conditionText && /touch-callout/.test(r.conditionText));
        for (const s of sup) for (const r of s.cssRules) {
          const alvo = r.cssRules ? [...r.cssRules] : [r];
          for (const q of alvo) {
            if (q.selectorText === ".barra-escura") base = { posicao: q.style.position, baixo: q.style.bottom, fundo: q.style.background || q.style.backgroundColor, altura: parseFloat(q.style.height) };
            if (q.selectorText === ".barra-escura.is-ativa") ativa = q.style.display;
          }
        }
      } catch { /* folha de outro domínio */ }
    }
    return { base, ativa, existe: !!document.getElementById("barra-escura") };
  });
  assert.ok(regra.existe, "falta o #barra-escura no HTML");
  assert.ok(regra.base, "falta a regra .barra-escura dentro de @supports (-webkit-touch-callout: none)");
  assert.equal(regra.base.posicao, "fixed");
  assert.equal(regra.base.baixo, "0px");
  assert.match(regra.base.fundo, /tinta|21, 21, 21|#151515/i);
  assert.ok(regra.base.altura >= 6, "o Safari só usa elementos fixos com pelo menos 6px");
  assert.equal(regra.ativa, "block");
  await page.close();
});

test("liga na primeira tela (faixa escura embaixo) e desliga depois do topo", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(servidor.url);
  await page.waitForTimeout(300);
  const ativa = () => page.$eval("#barra-escura", (b) => b.classList.contains("is-ativa"));
  assert.equal(await ativa(), true, "na primeira tela a barra precisa ficar escura");
  await page.evaluate(() => window.scrollTo({ top: document.getElementById("links").offsetTop, behavior: "instant" }));
  await page.waitForTimeout(300);
  assert.equal(await ativa(), false, "na seção Links a barra volta à cor da página");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);
  assert.equal(await ativa(), true, "voltando ao topo a barra fica escura de novo");
  await page.close();
});
