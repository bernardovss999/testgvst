// Pedido do cliente: no desktop (1920x970) a faixa "Marcas que já colaboramos" ficava cortada no fim da primeira tela.
// Hoje o topo é proporcional: nome, texto, foto, números e marcas cabem na primeira tela, do notebook ao celular.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

const TELAS = [[1920, 970], [1440, 900], [1536, 730], [1366, 657], [1280, 800], [1024, 700], [768, 1024], [430, 932], [390, 844], [390, 664]];
for (const [w, h] of TELAS) {
  test(`marcas inteiras na primeira tela em ${w}x${h}`, async () => {
    const celular = w < 700;
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: celular, hasTouch: celular });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500); // entrada do topo termina
    const r = await page.evaluate(() => ({
      logos: document.querySelector(".marcas-topo .letreiro").getBoundingClientRect().bottom,
      largura: document.documentElement.scrollWidth
    }));
    assert.ok(r.logos <= h + 1, `logos das marcas terminam em ${Math.round(r.logos)}px (tela de ${h}px)`);
    assert.ok(r.largura <= w, `rolagem lateral: ${r.largura}px`);
    await page.close();
  });
}

// Reunião de 29/10: "O homem performático" saiu do topo; a frase dos territórios virou o destaque
test("texto do topo: a frase dos territórios em destaque, com o rabisco num dos termos", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const t = await page.evaluate(() => ({
    lede: document.querySelector(".hero__lede").textContent.trim(),
    ledePx: parseFloat(getComputedStyle(document.querySelector(".hero__lede")).fontSize),
    rabisco: !!document.querySelector(".hero__lede .destaque .rabisco")
  }));
  assert.equal(t.lede, "Humor, lifestyle, wellness e moda.");
  assert.ok(t.ledePx >= 24, `frase do topo pequena demais: ${t.ledePx}px`);
  assert.ok(t.rabisco, "o rabisco azul continua num termo do topo");
  await page.close();
});
