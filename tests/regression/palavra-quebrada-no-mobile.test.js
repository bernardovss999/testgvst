// Bug original: no celular, "PERFORMÔMETRO" quebrava no meio da palavra e "ENVIAR PROPOSTA" virava duas linhas no botão.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

// quantas linhas o texto ocupa (pela contagem de retângulos de linha)
const linhas = (sel) => [...document.querySelectorAll(sel)].map((el) => {
  const r = document.createRange(); r.selectNodeContents(el);
  const tops = new Set([...r.getClientRects()].map((x) => Math.round(x.top)));
  return [el.textContent.trim(), tops.size];
});

for (const w of [320, 360, 390, 430]) {
  test(`${w}px: título do performômetro e botões cabem em uma linha`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: 800 }, isMobile: true, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const quebrados = (await page.evaluate(linhas, ".monte__t, .hero__ctas .btn, .cupom__copiar, .dock__cta, .rede-card__cta"))
      .filter(([, n]) => n > 1);
    assert.deepEqual(quebrados, []);
    await page.close();
  });
}
