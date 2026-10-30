// Bug original: títulos largos ("O HOMEM PERFORMÁTICO", "CERAVE", "AUDIÊNCIA", "VAMOS CONVERSAR?") vazavam da própria caixa e cobriam a coluna ao lado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

for (const [w, h] of [[1440, 900], [1024, 768], [375, 812]]) {
  test(`nenhum título passa da própria caixa em ${w}px`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const vazados = await page.evaluate(() => [...document.querySelectorAll(".titulo, .case__nome, .contato__titulo, .soma__num")].filter((el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect().right > el.getBoundingClientRect().right + 2;
    }).map((el) => el.textContent.trim()));
    assert.deepEqual(vazados, []);
    await page.close();
  });
}
