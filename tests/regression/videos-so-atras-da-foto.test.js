// Pedido do cliente: os vídeos do fundo ficavam só atrás da foto; agora passam no topo inteiro, desfocados,
// a faixa de seguidores ficou mais compacta e os logos de "Marcas que já colaboramos" aparecem coloridos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

for (const [w, h] of [[1440, 900], [390, 844]]) {
  test(`vídeos cobrem o topo inteiro, desfocados, atrás do texto em ${w}px`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(servidor.url);
    const r = await page.evaluate(() => {
      const v = document.querySelector(".vitrine"), hero = document.querySelector(".hero");
      const rv = v.getBoundingClientRect(), rh = hero.getBoundingClientRect();
      const marcas = document.querySelector(".marcas-topo").getBoundingClientRect();
      return { dentroDoHero: v.parentElement === hero, esq: rv.left, dir: rv.right, topo: rv.top - rh.top, fim: rv.bottom, marcas: marcas.top,
        filtro: getComputedStyle(v).filter, largura: innerWidth, sw: document.documentElement.scrollWidth };
    });
    assert.ok(r.dentroDoHero, "vitrine precisa estar no topo inteiro, não só na foto");
    assert.ok(r.esq <= 1 && r.dir >= r.largura - 1, `vídeos não cobrem a largura: ${r.esq}–${r.dir}`);
    assert.ok(r.topo <= 1 && r.fim >= r.marcas, "vídeos precisam ir do topo até as marcas");
    assert.match(r.filtro, /blur\(/);
    assert.ok(r.sw <= w, `rolagem lateral: ${r.sw}px`);
    await page.close();
  });
}

test("números de seguidores mais compactos e logos das marcas coloridos", async () => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 970 }, reducedMotion: "reduce" });
  await page.goto(servidor.url);
  const r = await page.evaluate(() => ({
    num: parseFloat(getComputedStyle(document.querySelector(".faixa__num")).fontSize),
    ico: document.querySelector(".faixa__ico").getBoundingClientRect().width,
    filtros: [...new Set([...document.querySelectorAll(".marcas-topo .letreiro__logo")].map((l) => getComputedStyle(l).filter))]
  }));
  assert.ok(r.num <= 24, `número dos seguidores com ${r.num}px`);
  // 29/10: os ícones viraram os logos coloridos das redes (pedido do cliente) e cresceram um pouco; a faixa segue compacta
  assert.ok(r.ico <= 26, `ícone dos seguidores com ${r.ico}px`);
  assert.deepEqual(r.filtros, ["none"], "logos das marcas não podem estar em cinza");
  await page.close();
});
