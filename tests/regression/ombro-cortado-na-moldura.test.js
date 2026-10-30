// Bug original: a foto ficava mais estreita que a moldura e o corte reto dos ombros aparecia dentro do arco.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

async function medir(page) {
  await page.waitForFunction(() => { const i = document.querySelector(".hero__rosto"); return i.complete && i.naturalWidth > 0; });
  return page.evaluate(() => ({
    foto: document.querySelector(".hero__rosto").getBoundingClientRect().toJSON(),
    moldura: document.querySelector(".retrato__moldura").getBoundingClientRect().toJSON()
  }));
}

function ombrosEscondidos({ foto, moldura }) {
  return foto.left < moldura.left - 2 && foto.right > moldura.right + 2 && foto.bottom >= moldura.bottom - 1;
}

for (const [w, h] of [[1920, 1000], [1440, 900], [768, 1024], [390, 844]]) {
  test(`moldura recorta os ombros e não corta o cabelo em ${w}px`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    const m = await medir(page);
    assert.ok(ombrosEscondidos(m), `corte dos ombros aparece dentro da moldura: ${JSON.stringify(m)}`);
    assert.ok(m.foto.top >= m.moldura.top - 2, `cabelo cortado no topo: foto ${m.foto.top.toFixed(0)} x moldura ${m.moldura.top.toFixed(0)}`);
    await page.close();
  });
}

test("o teste pega o defeito com a foto antiga, mais estreita que a moldura", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(servidor.url);
  await page.addStyleTag({ content: ".hero__rosto{width:94%!important;bottom:0!important}" });
  assert.equal(ombrosEscondidos(await medir(page)), false);
  await page.close();
});
