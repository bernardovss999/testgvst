// Bug original: na ficha embaixo dos reels da home, "QUINTOANDAR" e "LEV BICICLETAS" ficavam cortados ao lado do logo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

for (const [w, h] of [[1440, 900], [1024, 768], [390, 844], [320, 568]]) {
  test(`nome e categoria da marca cabem na ficha em ${w}px`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const cortados = await page.$$eval(".publi-card:not([data-clone])", (cards) => cards.flatMap((c) => {
      const ficha = c.querySelector(".publi-card__ficha").getBoundingClientRect();
      return [".publi-card__marca", ".publi-card__cat"].filter((s) => {
        const el = c.querySelector(s);
        const g = document.createRange(); g.selectNodeContents(el);
        return g.getBoundingClientRect().right > ficha.right + 1 || el.scrollWidth > el.clientWidth + 1;
      }).map((s) => `${c.querySelector(".publi-card__marca").textContent} ${s}`);
    }));
    assert.deepEqual(cortados, []);
    await page.close();
  });
}
