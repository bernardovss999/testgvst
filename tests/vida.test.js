// Topo animado, jogo do personagem, letreiro de marcas e respeito a "reduzir movimento".
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "./playwright.js";
import { iniciar, SEM_REDE, RAIZ } from "./servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

test("topo usa o retrato novo do Gustavo", async () => {
  const html = await readFile(join(RAIZ, "index.html"), "utf8");
  assert.match(html, /class="hero__rosto" src="assets\/img\/gustavo-rosto\.webp"/);
  assert.doesNotMatch(html, /gustavo-recorte\.webp" width="469"[^>]*fetchpriority/);
});

test("vitrine do topo: vídeos dele tocam no fundo, mudos, em baixa opacidade e escondidos de leitores de tela", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  await page.waitForFunction(() => [...document.querySelectorAll(".vitrine video")].filter((v) => !v.paused && v.readyState >= 2).length >= 3, null, { timeout: 15000 });
  const r = await page.evaluate(() => {
    const vitrine = document.querySelector(".vitrine");
    const videos = [...vitrine.querySelectorAll("video")];
    return {
      ariaHidden: vitrine.getAttribute("aria-hidden"),
      opacidade: Number(getComputedStyle(vitrine).opacity),
      mudos: videos.every((v) => v.muted && v.loop && v.playsInline),
      tiles: vitrine.querySelectorAll(".tile").length,
      animacao: getComputedStyle(vitrine.querySelector(".vitrine__col")).animationName
    };
  });
  assert.equal(r.ariaHidden, "true");
  assert.ok(r.opacidade > 0 && r.opacidade <= 0.5, `opacidade ${r.opacidade}`);
  assert.ok(r.mudos, "vídeos do fundo precisam ser mudos, em loop e inline");
  assert.ok(r.tiles >= 24, `só ${r.tiles} tiles (com as cópias do loop)`);
  assert.equal(r.animacao, "subir");
  await page.close();
});

test("vídeos do fundo não baixam nada antes de aparecer na tela", async () => {
  const html = await readFile(join(RAIZ, "index.html"), "utf8");
  const videos = html.match(/<video class="tile"[^>]*>[\s\S]*?<\/video>/g);
  assert.ok(videos.length >= 4);
  for (const v of videos) {
    assert.match(v, /preload="none"/);
    assert.doesNotMatch(v, /<source src=/, "o src real só entra via JS (data-src)");
  }
});

test("com 'reduzir movimento' nada se mexe e os vídeos do fundo não tocam", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(servidor.url);
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({
    tocando: [...document.querySelectorAll(".vitrine video")].filter((v) => !v.paused).length,
    letreiro: getComputedStyle(document.querySelector(".letreiro__trilho")).animationName,
    sticker: getComputedStyle(document.querySelector(".sticker--pov")).animationName
  }));
  assert.equal(r.tocando, 0);
  assert.deepEqual([r.letreiro, r.sticker], ["none", "none"]);
  await page.close();
});

test("letreiro de marcas tem o conteúdo duplicado para o loop não dar salto", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const r = await page.evaluate(() => {
    const conta = (sel) => { const t = document.querySelector(sel); return { total: t.children.length, clones: t.querySelectorAll(":scope > [data-clone]").length }; };
    return { letreiro: conta(".letreiro__trilho"), marcas: document.querySelectorAll(".publi-card:not([data-clone])").length };
  });
  assert.equal(r.letreiro.clones * 2, r.letreiro.total);
  assert.equal(r.letreiro.clones, r.marcas, "toda marca das publis aparece no letreiro");
  await page.close();
});

test("jogo do homem performático: cada item sobe o medidor até 100%", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const itens = page.locator("#monte .item");
  const n = await itens.count();
  assert.equal(n, 6);
  const leitura = () => page.evaluate(() => ({
    valor: Number(document.getElementById("medidor").getAttribute("aria-valuenow")),
    texto: document.getElementById("nivel").textContent,
    frase: document.getElementById("nivel-frase").textContent
  }));
  assert.deepEqual(await leitura(), { valor: 0, texto: "0%", frase: "Apenas um cara tranquilo" });
  for (let i = 0; i < n; i++) await itens.nth(i).click();
  const cheio = await leitura();
  assert.equal(cheio.valor, 100);
  assert.match(cheio.frase, /100% homem performático/);
  assert.equal(await itens.first().getAttribute("aria-pressed"), "true");
  await itens.first().click();
  assert.equal((await leitura()).valor, 83, "desmarcar um item baixa o medidor");
  await page.close();
});

test("frases do medidor seguem os níveis", async () => {
  const page = await browser.newPage();
  await page.goto(servidor.url);
  const frases = await page.evaluate(() => [0, 1, 2, 3, 4, 5, 6].map((q) => globalThis.GVST.frasePara(q)));
  assert.deepEqual(frases, ["Apenas um cara tranquilo", "Começando a performar", "Começando a performar", "Achei conceito", "Achei conceito", "Bem astéric", "100% homem performático 💆🏾‍♂️"]);
  await page.close();
});
