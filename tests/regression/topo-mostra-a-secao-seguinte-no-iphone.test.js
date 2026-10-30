// Pedido do cliente (29/10): no iPhone (Safari com a barra de baixo transparente) o fim da primeira tela já mostrava
// o começo da seção seguinte ("LINKS DO..."). O topo media 100svh (tela com as barras abertas), mas a página aparece
// também atrás da barra. Agora a faixa escura das marcas se estende pela diferença 100lvh - 100svh no celular/tablet.
// O emulador não tem barra do Safari (lvh = svh), então o teste confere a regra e o resultado sem barra.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

test("celular: a faixa das marcas cobre também a área atrás da barra do Safari", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(servidor.url);
  const regras = await page.evaluate(() => {
    const achadas = [];
    const ler = (lista, media) => {
      for (const r of lista) {
        if (r.cssRules && r.media) ler(r.cssRules, r.media.mediaText);
        else if (r.selectorText === ".marcas-topo" && /lvh/.test(r.style.paddingBottom)) achadas.push({ media, valor: r.style.paddingBottom });
      }
    };
    for (const folha of document.styleSheets) { try { ler(folha.cssRules, ""); } catch { /* folha de outro domínio */ } }
    return achadas;
  });
  const celular = regras.find((r) => /max-width:\s*960px/.test(r.media) && /100lvh\s*-\s*100svh/.test(r.valor));
  assert.ok(celular, `faltou a extensão 100lvh - 100svh na faixa das marcas: ${JSON.stringify(regras)}`);
  await page.close();
});

for (const [w, h] of [[320, 568], [390, 844], [430, 932], [768, 1024]]) {
  test(`${w}x${h}: a primeira tela é só o topo, e a seção Links começa logo depois`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => ({
      hero: document.querySelector(".hero").getBoundingClientRect().bottom,
      links: document.querySelector("#links").getBoundingClientRect().top
    }));
    assert.ok(r.hero >= h - 1, `o topo termina em ${Math.round(r.hero)}px, antes do fim da tela (${h}px)`);
    assert.ok(Math.abs(r.links - r.hero) <= 1, "Links começa logo depois do topo");
    await page.close();
  });
}
