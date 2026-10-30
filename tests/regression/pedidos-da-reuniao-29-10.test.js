// Pedidos da reunião de 29/10: topo sem "O homem performático", 3 marcas a menos, links e publis mais enxutos,
// sem eventos, sem o vídeo do Zeca, página própria de publis e celular no ritmo de um Reels.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE, RAIZ } from "../servidor.js";

let servidor, browser, html, publis;
before(async () => {
  servidor = await iniciar(0, { ler: SEM_REDE });
  browser = await chromium.launch();
  html = await readFile(join(RAIZ, "index.html"), "utf8");
  publis = await readFile(join(RAIZ, "publis.html"), "utf8");
});
after(async () => { await browser?.close(); servidor?.srv.close(); });

const secao = (h, id) => h.split(`id="${id}"`)[1].split("</section>")[0];

// O rabisco começou em "Humor" e foi para "lifestyle" na segunda rodada de ajustes (29/10);
// a legenda da foto foi de "Pov" para "Pov performático" na terceira rodada (pedido do cliente)
test("topo: sem a frase 'O homem performático', legenda da foto 'Pov performático' e rabisco num termo dos territórios", () => {
  const topo = html.split('id="inicio"')[1].split('class="faixa')[0];
  const semSeloNemLegenda = topo.replace(/<svg class="selo"[\s\S]*?<\/svg>/, "").replace(/<p class="sticker sticker--pov"[^<]*<\/p>/, "");
  assert.doesNotMatch(semSeloNemLegenda, /homem performático/i);
  assert.match(topo, /class="sticker sticker--pov" aria-hidden="true">Pov performático<\/p>/);
  assert.match(topo, /class="hero__lede">Humor, <em class="destaque">lifestyle<svg class="rabisco"/);
  const lede = topo.match(/<p class="hero__lede">([\s\S]*?)<\/p>/)[1].replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "");
  assert.equal(lede, "Humor, lifestyle, wellness e moda.");
});

test("marcas: sem Coca-Cola, Voe Nuvy e Bold Snacks; Tuyo continua", () => {
  const letreiro = html.split('class="marcas-topo"')[1].split("</section>")[0];
  for (const fora of ["Coca-Cola", "Voe Nuvy", "Bold Snacks"]) {
    assert.ok(!letreiro.includes(`alt="${fora}"`), `${fora} ainda no letreiro`);
    assert.ok(!publis.includes(`>${fora}<`), `${fora} ainda nas publis`);
    assert.ok(!html.includes(`>${fora}<`), `${fora} ainda na home`);
  }
  assert.ok(letreiro.includes('alt="Tuyo"'));
  assert.ok(publis.includes('class="marca__nome">Tuyo<'));
});

test("links: só 'Vlogs da vida no Rio' e 'Contato comercial'; cupom da Tuyo preparado", () => {
  const links = secao(html, "links");
  const titulos = [...links.matchAll(/class="ml__t">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(titulos, ["Vlogs da vida no Rio", "Contato comercial"]);
  assert.match(links, /<article class="cupom"[^>]*>\s*<div class="cupom__lado">\s*<img src="assets\/img\/marcas\/tuyo\.webp"/);
});

test("cupom sem código não aparece (nem como botão vazio)", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const r = await page.$$eval(".cupom", (cs) => cs.map((c) => ({
    visivel: getComputedStyle(c).display !== "none",
    codigo: c.querySelector(".cupom__copiar").getAttribute("data-cupom")
  })));
  for (const c of r) if (c.visivel) assert.ok(c.codigo, "cupom visível precisa ter código");
  assert.ok(r.filter((c) => c.visivel).length >= 2, "Zerezes e Lev continuam");
  await page.close();
});

test("eventos e convites saíram; mais vistos sem o vídeo do Zeca", () => {
  assert.doesNotMatch(html + publis, /Eventos e convites|class="eventos/);
  const vistos = html.split('class="mais-vistos"')[1].split("</ul>")[0];
  assert.ok(!vistos.includes("7146205450210512134") && !/Zeca/.test(vistos), "vídeo do Zeca ainda está nos mais vistos");
  assert.equal((vistos.match(/class="player"/g) || []).length, 3);
});

test("publis na home: um reel por marca passando na horizontal, nome embaixo, e cada um leva à página da marca", async () => {
  const bloco = secao(html, "trabalhos");
  assert.ok(!bloco.includes('class="player"'), "a home não tem mais a lista completa com players");
  const cards = [...bloco.matchAll(/<li class="publi-card">\s*<a href="publis\.html#(marca-[\w-]+)">[\s\S]*?class="publi-card__marca">([^<]+)</g)];
  const marcas = [...publis.matchAll(/class="marca__nome">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(cards.map((c) => c[2]), marcas, "um card por marca, na mesma ordem");
  for (const [, id] of cards) assert.ok(publis.includes(`id="${id}"`), `publis.html#${id} sem destino`);
  assert.match(bloco, /href="publis\.html">Ver todas as publis</);

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const r = await page.evaluate(() => {
    const trilho = document.querySelector(".carrossel__trilho");
    const sec = document.getElementById("trabalhos").getBoundingClientRect();
    const capa = document.querySelector(".publi-card__capa").getBoundingClientRect();
    const nome = document.querySelector(".publi-card__marca").getBoundingClientRect();
    return {
      animacao: getComputedStyle(trilho).animationName,
      clonesFora: [...trilho.querySelectorAll("[data-clone] a")].every((a) => a.tabIndex === -1),
      altura: sec.height, nomeEmbaixo: nome.top >= capa.bottom - 1
    };
  });
  assert.equal(r.animacao, "correr");
  assert.ok(r.clonesFora, "cópias do loop não entram no Tab");
  assert.ok(r.nomeEmbaixo, "nome da marca fica embaixo do reel");
  // com a ficha da marca embaixo de cada reel (pedido da segunda rodada) o bloco cresceu, mas segue bem menor que a lista antiga
  assert.ok(r.altura < 1400, `bloco de publis da home com ${Math.round(r.altura)}px`);
  await page.close();
});

test("página de publis: todas as marcas, com cabeçalho, contato e sem chamar o contador", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const chamadas = [];
  page.on("request", (q) => { if (q.url().includes("/api/seguidores")) chamadas.push(q.url()); });
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.goto(servidor.url + "publis.html#marca-cerave");
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({
    marcas: document.querySelectorAll(".publi-marca").length,
    alvo: document.querySelector(".publi-marca:target .marca__nome")?.textContent,
    navAtual: document.querySelector("#nav [aria-current=page]")?.textContent,
    contato: !!document.getElementById("contato")
  }));
  assert.equal(r.marcas, 11);
  assert.equal(r.alvo, "CeraVe");
  assert.equal(r.navAtual, "Publis");
  assert.ok(r.contato);
  assert.deepEqual(chamadas, []);
  assert.deepEqual(erros, []);
  await page.close();
});

for (const [w, h] of [[320, 568], [390, 844], [430, 932]]) {
  test(`página de publis no celular (${w}px): nada vaza para os lados`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await page.goto(servidor.url + "publis.html");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= w);
    await page.close();
  });
}
