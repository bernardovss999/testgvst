// Pedido do cliente (vídeo de 22/10): rótulos "Seguidores do ..." na faixa, topo mais baixo e
// "Marcas que já colaboramos" logo abaixo dos números, no lugar da faixa de bordões, antes dos links.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE, RAIZ } from "../servidor.js";

let servidor, browser, html;
before(async () => {
  servidor = await iniciar(0, { ler: SEM_REDE });
  browser = await chromium.launch();
  html = await readFile(join(RAIZ, "index.html"), "utf8");
});
after(async () => { await browser?.close(); servidor?.srv.close(); });

test("faixa do topo diz de quem são os seguidores", () => {
  const faixa = html.split('class="faixa wrap"')[1].split("</div>")[0];
  for (const rede of ["Instagram", "TikTok", "YouTube"]) assert.match(faixa, new RegExp(`class="rotulo">Seguidores do ${rede}<`));
  assert.match(faixa, /Seguidores somados ao vivo/);
});

test("ordem: topo → marcas que já colaboramos → links → ... → publis completas", () => {
  const pos = (s) => { const i = html.indexOf(s); assert.ok(i > 0, `${s} ausente`); return i; };
  const ordem = [pos('id="inicio"'), pos('class="marcas-topo"'), pos('id="links"'), pos('id="trabalhos"')];
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem);
  assert.ok(!html.includes('class="ticker"'), "a faixa de bordões foi trocada pelas marcas");
  const publis = html.split('id="trabalhos"')[1];
  assert.ok(!publis.includes('class="letreiro"'), "o letreiro não se repete nas publis");
});

// Desde 29/10 as publis completas ficam em publis.html (Coca-Cola, Voe Nuvy e Bold Snacks saíram: 11 marcas)
test("todas as marcas das publis passam no letreiro do topo", async () => {
  const topo = html.split('class="marcas-topo"')[1].split("</section>")[0];
  const publis = await readFile(join(RAIZ, "publis.html"), "utf8");
  const nomes = [...publis.matchAll(/class="marca__nome">([^<]+)</g)].map((m) => m[1]);
  assert.ok(nomes.length >= 11);
  for (const n of nomes) assert.ok(topo.includes(`alt="${n}"`), `marca ${n} fora do letreiro`);
  assert.match(topo, /Marcas que já colaboramos/);
});

for (const [w, h, max] of [[1440, 900, 900], [1920, 1000, 1000], [390, 844, 1400]]) {
  test(`topo mais baixo: as marcas aparecem cedo em ${w}px`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    const topoMarcas = await page.$eval(".marcas-topo", (el) => el.getBoundingClientRect().top + scrollY);
    assert.ok(topoMarcas <= max, `faixa de marcas começa em ${Math.round(topoMarcas)}px (máx ${max})`);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(largura <= w, `rolagem lateral: ${largura}px`);
    await page.close();
  });
}

// Pedido do cliente: o botão das marcas diz só "Ver as publis", sem número.
test("botão das marcas diz 'Ver as publis' sem número", async () => {
  const atual = await readFile(join(RAIZ, "index.html"), "utf8");
  const texto = atual.match(/class="marcas-topo__ver"[^>]*>([^<]+)</)[1];
  assert.equal(texto, "Ver as publis");
  assert.doesNotMatch(texto, /\d/);
});
