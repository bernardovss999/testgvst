// Bug original: com o rosto novo, "GUSTAVO" ficava maior que a coluna de texto e encostava no cabelo dele (1920px).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

for (const [w, h] of [[1920, 1000], [1440, 900], [1280, 800], [1024, 768]]) {
  test(`nome cabe na coluna de texto e não encosta no rosto em ${w}px`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const texto = (sel) => { const r = document.createRange(); r.selectNodeContents(document.querySelector(sel)); return r.getBoundingClientRect(); };
      return {
        l1: texto(".hero__l1").right, l2: texto(".hero__l2").right,
        coluna: document.querySelector(".hero__texto-col").getBoundingClientRect().right,
        rosto: document.querySelector(".hero__rosto").getBoundingClientRect().left
      };
    });
    assert.ok(m.l1 <= m.coluna + 1 && m.l2 <= m.coluna + 1, `nome passa da coluna: ${JSON.stringify(m)}`);
    assert.ok(m.l1 <= m.rosto && m.l2 <= m.rosto, `nome encosta no rosto: ${JSON.stringify(m)}`);
    await page.close();
  });
}
