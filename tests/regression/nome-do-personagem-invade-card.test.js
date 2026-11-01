// Bug (01/11): em 390px o nome "HOMEM PERFORMÁTICO" do card da seção Personagens passava por cima do card vizinho.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

for (const w of [320, 360, 390, 430, 1440]) {
  test(`${w}px: nome de cada personagem cabe no próprio card e os vídeos ficam alinhados`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: 844 }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("#personagem .persona-card")];
      return {
        vazando: cards.filter((c) => { const n = c.querySelector(".persona-card__nome"); return n.scrollWidth > c.clientWidth + 1; }).map((c) => c.id),
        topos: new Set(cards.map((c) => Math.round(c.querySelector(".player").getBoundingClientRect().top))).size
      };
    });
    assert.deepEqual(r.vazando, []);
    assert.equal(r.topos, 1, "capas na mesma altura");
    await page.close();
  });
}
