// Pedido de 01/11: o botão "Ver todos os personagens" e o Performômetro com a mesma largura, alinhados
// (antes o botão era menor e terminava fora do alinhamento da coluna do Performômetro).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

for (const [nome, url, w] of [["site 1440px", "", 1440], ["site 1280px", "", 1280], ["site 1920px", "", 1920], ["media kit (PDF)", "index.html?pdf=1", 1440]]) {
  test(`${nome}: botão com a largura e o alinhamento da coluna do Performômetro`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, reducedMotion: "reduce" });
    await page.goto(servidor.url + url);
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const b = document.querySelector("#personagem .cabeca > .btn").getBoundingClientRect();
      const m = document.getElementById("monte").getBoundingClientRect();
      return { esq: Math.round(b.left - m.left), dir: Math.round(b.right - m.right), acima: b.bottom <= m.top };
    });
    assert.ok(Math.abs(r.esq) <= 1 && Math.abs(r.dir) <= 1, `bordas desalinhadas: esquerda ${r.esq}px, direita ${r.dir}px`);
    assert.ok(r.acima, "botão em cima do Performômetro");
    await page.close();
  });
}
