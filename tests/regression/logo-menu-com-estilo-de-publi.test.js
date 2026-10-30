// Bug original: a classe .marca (logo GVST do menu) foi reaproveitada nas linhas de publi e o logo do menu virou um grid com borda e padding.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

test("logo GVST do menu continua um link simples", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const estilo = await page.$eval(".topo .marca", (el) => {
    const c = getComputedStyle(el);
    return { display: c.display, padding: c.paddingTop, borda: c.borderBottomWidth, altura: el.getBoundingClientRect().height };
  });
  assert.notEqual(estilo.display, "grid");
  assert.equal(estilo.padding, "0px");
  assert.equal(estilo.borda, "0px");
  assert.ok(estilo.altura < 40, `logo com ${estilo.altura}px de altura`);
  await page.close();
});
