// Bug original: o card da CeraVe ocupava 2 colunas e deixava o card da Zerezes sozinho na última linha (desktop e tablet).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

for (const [w, h] of [[1440, 900], [1024, 768]]) {
  test(`trabalhos preenchem linhas completas em ${w}px`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(servidor.url + "publis.html");
    const tops = await page.$$eval(".marcas > li", (lis) => lis.map((li) => Math.round(li.getBoundingClientRect().top)));
    const porLinha = Object.values(tops.reduce((a, t) => ((a[t] = (a[t] || 0) + 1), a), {}));
    assert.ok(porLinha.every((n) => n === porLinha[0]), `cards por linha: ${porLinha}`);
    await page.close();
  });
}
