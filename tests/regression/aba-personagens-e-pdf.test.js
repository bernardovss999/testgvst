// Pedidos de 01/11: a seção Personagens da home ficou enxuta (sem o título grande "O homem performático", um vídeo de
// cada personagem); "Personagens" no menu abre a página personagens.html, que tem só os vídeos de todos os personagens;
// o PDF tem uma página só de personagens; /media-kit é a página para baixar o PDF.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE, RAIZ } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

const ler = (a) => readFile(join(RAIZ, a), "utf8");
const PAGINAS = ["index.html", "publis.html", "personagens.html", "media-kit.html"];

test("seção Personagens da home: h2, um vídeo de cada personagem (h3) e o botão para personagens.html", async () => {
  const h = (await ler("index.html")).replace(/<!--[\s\S]*?-->/g, "");
  const sec = h.split('id="personagem"')[1].split("</section>")[0];
  assert.match(sec, /<h2 class="titulo" id="personagem-titulo">Personagens<\/h2>/);
  assert.doesNotMatch(sec, /O homem<br>performático|personagens__pills/);
  assert.match(sec, /id="monte"/, "Performômetro ao lado dos personagens (pedido seguinte de 01/11)");
  const nomes = [...sec.matchAll(/<h3 class="persona-card__nome">([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(nomes, ["Homem performático", "Playboy emitido a cria", "Hétero top"]);
  assert.equal((sec.match(/class="player"/g) || []).length, 3, "um vídeo por personagem");
  assert.match(sec, /<a class="btn btn--claro" href="personagens\.html">Ver todos os personagens<\/a>/);
});

test("'Personagens' no menu abre a página personagens.html (em todas as páginas)", async () => {
  for (const arq of PAGINAS) {
    const nav = (await ler(arq)).split('id="nav"')[1].split("</nav>")[0];
    assert.match(nav, /<a href="personagens\.html"( aria-current="page")?>Personagens<\/a>/, arq);
    assert.doesNotMatch(nav, /#personagem"/, `${arq}: menu não leva mais para a seção da home`);
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  await page.locator("#nav a", { hasText: "Personagens" }).click();
  await page.waitForURL(/personagens\.html$/);
  assert.equal(await page.locator("h1").textContent(), "Personagens");
  await page.close();
});

test("personagens.html tem só os vídeos de todos os personagens (sem Performômetro nem atalhos)", async () => {
  const h = (await ler("personagens.html")).replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(h, /id="monte"|personagens__pills|id="homem-performatico"/);
  const main = h.split('<main id="conteudo">')[1].split('<section class="contato"')[0];
  assert.equal((main.match(/<section /g) || []).length, 1, "uma seção: a lista dos personagens");
  assert.deepEqual([...main.matchAll(/<h2 class="marca__nome">([^<]+)<\/h2>/g)].map((m) => m[1]), ["Homem performático", "Playboy emitido a cria", "Hétero top"]);
});

// padrão novo (01/11): a página Personagens do PDF é a seção do site, com capas estáticas que viram links
test("PDF: página Personagens igual à seção do site (3 personagens + Performômetro), capas locais e links completos", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url + "index.html?pdf=1");
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.querySelectorAll("#personagem img")].map((i) => (i.loading = "eager", i.decode().catch(() => {})))));
  const r = await page.evaluate(() => {
    const s = document.getElementById("personagem");
    const cards = [...s.querySelectorAll(".persona-card")].map((c) => c.getBoundingClientRect());
    const monte = document.getElementById("monte").getBoundingClientRect();
    return {
      nomes: [...s.querySelectorAll(".persona-card__nome")].map((n) => n.textContent),
      quartaColuna: monte.left > cards[2].right && Math.abs(monte.top - cards[0].top) <= 2,
      remotas: [...s.querySelectorAll("img")].filter((i) => !i.getAttribute("src").startsWith("assets/img/videos/")).length,
      quebradas: [...s.querySelectorAll("img")].filter((i) => !i.naturalWidth).length,
      embeds: s.querySelectorAll("iframe, video").length,
      links: globalThis.GVST.linksDoGrupo([s]).map((l) => l.url)
    };
  });
  assert.deepEqual(r.nomes, ["Homem performático", "Playboy emitido a cria", "Hétero top"]);
  assert.ok(r.quartaColuna, "Performômetro na 4ª coluna, como no site");
  assert.equal(r.remotas, 0);
  assert.equal(r.quebradas, 0);
  assert.equal(r.embeds, 0, "sem embed nem vídeo no PDF");
  const reels = r.links.filter((u) => /instagram\.com\/gvstavocorrea\/reel\/|tiktok\.com/.test(u));
  assert.ok(reels.length >= 6, "capas e links dos vídeos clicáveis no PDF");
  assert.ok(r.links.some((u) => /\/personagens\.html$/.test(u)), "'Ver todos os personagens' clicável");
  const rel = await page.evaluate(async () => { await globalThis.GVST.gerarPdfAqui(); return globalThis.GVST.relatorioPdf.map((p) => p.secoes[0]); });
  assert.deepEqual(rel.slice(2, 5), ["sobre", "personagem", "filmes"]);
  await page.close();
});

test("/media-kit: página de baixar o PDF, noindex, fora do menu, com botão do gerador e link direto", async () => {
  const r = await fetch(servidor.url + "media-kit");
  assert.equal(r.status, 200);
  const h = await r.text();
  assert.match(h, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(h, /<button class="btn btn--ink" type="button" data-imprimir>/);
  assert.match(h, /<a class="btn btn--line" href="api\/media-kit" download>/);
  assert.match(h, /src="assets\/js\/mediakit\.js"/);
  for (const arq of PAGINAS) {
    const nav = (await ler(arq)).split('id="nav"')[1].split("</nav>")[0];
    assert.doesNotMatch(nav, /media-kit/, `${arq}: a página não entra no menu`);
  }
  const vercel = JSON.parse(await ler("vercel.json"));
  assert.deepEqual(vercel.rewrites, [{ source: "/media-kit", destination: "/media-kit.html" }]);
  assert.ok((await ler("scripts/publicar.mjs")).includes('SEMPRE_NOINDEX = ["media-kit.html"'), "continua noindex ao publicar");
});

test("o botão 'Baixar PDF' da página entrega o PDF do servidor", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await page.goto(servidor.url + "media-kit");
  const download = page.waitForEvent("download", { timeout: 120000 });
  await page.locator("[data-imprimir]").click();
  const arq = await download;
  assert.match(arq.suggestedFilename(), /^media-kit-gustavo-correa-\d{4}-\d{2}-\d{2}\.pdf$/);
  await page.close();
});
