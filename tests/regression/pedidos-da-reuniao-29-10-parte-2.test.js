// Segunda rodada de ajustes (29/10): rabisco em "lifestyle", letreiro alternando marca famosa e menos conhecida,
// cupom GVST10 da Tuyo, ficha da marca embaixo de cada reel da home, Sobre antes do Personagem, publicações
// conferidas pela lista do cliente e celular fluido e animado (sem encaixe de rolagem).
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

test("topo: o rabisco fica em 'lifestyle'", () => {
  const lede = html.match(/<p class="hero__lede">([\s\S]*?)<\/p>/)[1];
  assert.match(lede, /<em class="destaque">lifestyle<svg class="rabisco"/);
  assert.equal(lede.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, ""), "Humor, lifestyle, wellness e moda.");
});

test("letreiro alterna marca muito famosa e marca menos conhecida", () => {
  const topo = html.split('class="marcas-topo"')[1].split("</section>")[0];
  const ordem = [...topo.matchAll(/class="letreiro__logo[^"]*"[^>]*alt="([^"]+)"/g)].map((m) => m[1]);
  const FAMOSAS = new Set(["TV Globo", "Nubank", "CeraVe", "QuintoAndar", "Reserva Go"]);
  assert.equal(ordem.length, 11);
  ordem.forEach((nome, i) => {
    if (i % 2 === 0 && i < 10) assert.ok(FAMOSAS.has(nome), `posição ${i + 1} devia ser marca famosa: ${nome}`);
    if (i % 2 === 1) assert.ok(!FAMOSAS.has(nome), `posição ${i + 1} devia ser marca menos conhecida: ${nome}`);
  });
});

test("cupom da Tuyo: GVST10, visível e copiável", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const tuyo = page.locator(".cupom", { has: page.locator('img[src$="tuyo.webp"]') });
  assert.ok(await tuyo.isVisible());
  assert.equal((await tuyo.locator(".cupom__codigo").textContent()).trim(), "GVST10");
  assert.equal(await tuyo.locator(".cupom__copiar").getAttribute("data-cupom"), "GVST10");
  assert.match(await tuyo.locator(".cupom__marca").textContent(), /10%/);
  await page.close();
});

test("home: embaixo de cada reel vem a ficha da marca (logo, nome, categoria, descrição e selo)", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const fichas = await page.$$eval(".publi-card:not([data-clone])", (cards) => cards.map((c) => {
    const capa = c.querySelector(".publi-card__capa").getBoundingClientRect();
    const ficha = c.querySelector(".publi-card__ficha").getBoundingClientRect();
    const tem = (s) => !!c.querySelector(s) && c.querySelector(s).getBoundingClientRect().height > 0;
    return {
      nome: c.querySelector(".publi-card__marca").textContent,
      embaixo: ficha.top >= capa.bottom - 1,
      completa: [".publi-card__logo", ".publi-card__cat", ".publi-card__desc", ".publi-card__resumo"].every(tem),
      selo: getComputedStyle(c.querySelector(".publi-card__resumo")).borderRadius
    };
  }));
  assert.equal(fichas.length, 11);
  for (const f of fichas) {
    assert.ok(f.embaixo, `${f.nome}: ficha devia ficar embaixo do reel`);
    assert.ok(f.completa, `${f.nome}: ficha incompleta`);
    assert.equal(f.selo, "999px", `${f.nome}: selo em pílula`);
  }
  await page.close();
});

test("'Vivências e umas bobeiras' (Sobre) vem antes de 'O personagem', no conteúdo e no menu", () => {
  assert.ok(html.indexOf('id="sobre"') < html.indexOf('id="personagem"'));
  for (const pagina of [html, publis]) {
    const nav = pagina.split('id="nav"')[1].split("</nav>")[0];
    // 01/11: "Personagens" no menu abre personagens.html (pedido do cliente), na mesma posição
    assert.ok(nav.indexOf("#sobre") < nav.indexOf("personagens.html"), "menu na mesma ordem da página");
  }
});

test("publicações conferidas pela lista do cliente: LEV ganhou 'De LEV, di marola' sem virar a capa da marca", () => {
  const lev = publis.split('id="marca-lev-bicicletas"')[1].split("</ul>")[0];
  assert.ok(lev.includes("/gvstavocorrea/reel/DfFUwQuxrbM/"));
  assert.equal((lev.match(/class="player"/g) || []).length, 3);
  // o card fica na faixa de publis (as logos do letreiro também linkam a marca desde 29/10)
  const card = html.split('class="carrossel__trilho"')[1].split('href="publis.html#marca-lev-bicicletas"')[1].split("</li>")[0];
  assert.ok(card.includes("ig-DYkPt0Wxn3l.webp"), "a capa da LEV na home segue o vídeo de maior alcance");
});

test("celular fluido: rolagem livre, carrosséis andam sozinhos e reações sobem", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
  await page.goto(servidor.url);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType), "none", "nada de encaixe travando a rolagem");
  await page.evaluate(() => { const g = document.querySelector(".galeria"); scrollTo({ top: g.getBoundingClientRect().top + scrollY - 200, behavior: "instant" }); });
  await page.waitForFunction(() => document.querySelector(".galeria").scrollLeft > 20, null, { timeout: 8000 });
  await page.waitForFunction(() => document.querySelectorAll(".reacoes span").length > 0, null, { timeout: 5000 });
  const r = await page.evaluate(() => ({
    foco: document.querySelectorAll(".galeria > .is-foco").length,
    reacoesOcultas: document.querySelector(".reacoes").getAttribute("aria-hidden"),
    largura: document.documentElement.scrollWidth
  }));
  assert.equal(r.foco, 1, "um item em destaque por vez");
  assert.equal(r.reacoesOcultas, "true");
  assert.ok(r.largura <= 390, `rolagem lateral: ${r.largura}px`);
  await page.close();
});

test("celular com 'reduzir movimento': carrosséis parados e sem reações", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await page.goto(servidor.url);
  await page.evaluate(() => { const g = document.querySelector(".galeria"); scrollTo({ top: g.getBoundingClientRect().top + scrollY - 200, behavior: "instant" }); });
  await page.waitForTimeout(3500);
  const r = await page.evaluate(() => ({ galeria: document.querySelector(".galeria").scrollLeft, reacoes: !!document.querySelector(".reacoes") }));
  assert.deepEqual(r, { galeria: 0, reacoes: false });
  await page.close();
});

test("carrossel automático para quando um vídeo é aberto", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
  await page.route(/tiktok\.com|instagram\.com/, (r) => r.fulfill({ body: "<html></html>", contentType: "text/html" }));
  await page.goto(servidor.url);
  const grade = page.locator(".mais-vistos .grade-videos");
  await grade.scrollIntoViewIfNeeded();
  await grade.locator(".player button").first().tap();
  await page.waitForTimeout(9500); // passa a pausa do toque (7 s) e mais um passo
  assert.equal(await grade.evaluate((g) => g.scrollLeft), 0, "não pode arrastar o vídeo que está tocando");
  await page.close();
});
