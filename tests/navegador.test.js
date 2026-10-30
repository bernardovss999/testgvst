// Testes no navegador: overflow por viewport, erros de console, contador ao vivo e menu.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "./playwright.js";
import { iniciar, SEM_REDE } from "./servidor.js";

let servidor, browser;
const VIEWPORTS = { mobile: [375, 812], tablet: [768, 1024], desktop: [1440, 900] };
const TIKTOK = ".plat__num[data-metrica='tiktok.seguidores']";

before(async () => {
  servidor = await iniciar(0, { ler: SEM_REDE });
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  servidor?.srv.close();
});

// Responde /api/seguidores com a base local alterada por `mexer`
async function simularApi(page, mexer) {
  await page.route("**/api/seguidores*", async (route) => {
    const r = await page.request.get(servidor.url + "dados/metricas.json");
    const j = await r.json();
    mexer(j);
    await route.fulfill({ json: j });
  });
}

for (const [nome, [w, h]] of Object.entries(VIEWPORTS)) {
  test(`sem overflow horizontal nem erros de console (${nome})`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const erros = [];
    page.on("pageerror", (e) => erros.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) erros.push(m.text()); });
    await page.goto(servidor.url, { waitUntil: "load" });
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(largura <= w, `scrollWidth ${largura} > ${w}`);
    assert.deepEqual(erros, []);
    await page.close();
  });
}

test("contador lê /api/seguidores e soma as três redes", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await simularApi(page, (j) => {
    j.plataformas.instagram.seguidores = { valor: 112789, aprox: false };
    j.plataformas.tiktok.seguidores = { valor: 159059, aprox: false };
    j.plataformas.youtube.inscritos = { valor: 6000, aprox: true };
  });
  await page.goto(servidor.url);
  await page.waitForFunction((sel) => document.querySelector(sel).getAttribute("aria-label") === "159.059", TIKTOK);
  assert.equal(await page.locator(".soma__num").getAttribute("aria-label"), "277.848");
  assert.match(await page.locator("#status-texto").textContent(), /^Ao vivo/);
  await page.close();
});

test("sem a API, usa dados/metricas.json e avisa que é a última leitura", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route("**/api/seguidores*", (route) => route.fulfill({ status: 502, body: "{}" }));
  await page.goto(servidor.url);
  await page.waitForFunction(() => document.getElementById("status-texto").textContent.startsWith("Última leitura"));
  await page.close();
});

test("contador reflete nova leitura a cada 15 s sem recarregar", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let seguidores = 159054;
  await simularApi(page, (j) => { j.plataformas.tiktok.seguidores = { valor: seguidores, aprox: false }; });
  await page.clock.install();
  await page.goto(servidor.url);
  await page.waitForFunction((sel) => document.querySelector(sel).getAttribute("aria-label") === "159.054", TIKTOK);
  seguidores = 159321;
  await page.clock.runFor(16000);
  await page.waitForFunction((sel) => document.querySelector(sel).getAttribute("aria-label") === "159.321", TIKTOK);
  await page.close();
});

test("conteúdo com efeito de revelação fica visível depois de rolar", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
  });
  await page.waitForTimeout(1200);
  const ocultos = await page.evaluate(() => [...document.querySelectorAll(".revela")].filter((el) => !el.classList.contains("is-visivel")).length);
  assert.equal(ocultos, 0);
  await page.close();
});

test("player: vídeo só carrega no clique e toca dentro do site", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/tiktok\.com|instagram\.com/, (route) => route.fulfill({ body: "<html></html>", contentType: "text/html" }));
  await page.goto(servidor.url + "publis.html");
  assert.equal(await page.locator(".player iframe").count(), 0, "nenhum embed antes do clique");
  const player = page.locator(".publi-marca .player[data-tiktok='7671401764389801234']");
  await player.locator("button.player__play").click();
  const src = await player.locator("iframe").getAttribute("src");
  assert.match(src, /^https:\/\/www\.tiktok\.com\/player\/v1\/7671401764389801234/);
  assert.equal(await player.evaluate((el) => el.classList.contains("is-tocando")), true);
  await page.close();
});

test("faixa do topo tem ícones das redes e do grupo somado", async () => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(servidor.url);
  const icones = await page.$$eval(".faixa__ico use", (us) => us.map((u) => u.getAttribute("href")));
  assert.deepEqual(icones, ["#i-instagram", "#i-tiktok", "#i-youtube", "#i-grupo"]);
  await page.close();
});

test("menu mobile abre e fecha ao clicar num link", async () => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(servidor.url);
  const btn = page.locator("#menu-btn");
  await btn.click();
  assert.equal(await btn.getAttribute("aria-expanded"), "true");
  await page.locator("#nav a[href='#trabalhos']").click();
  assert.equal(await btn.getAttribute("aria-expanded"), "false");
  await page.close();
});

test("hero mobile: nome, foto e texto não se sobrepõem de forma ilegível", async () => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(servidor.url);
  const r = await page.evaluate(() => {
    const b = (s) => document.querySelector(s).getBoundingClientRect();
    return { l1: b(".hero__l1"), l2: b(".hero__l2"), texto: b(".hero__texto"), largura: innerWidth };
  });
  assert.ok(r.l1.right <= r.largura + 1 && r.l2.right <= r.largura + 1, "nome não pode vazar da tela");
  assert.ok(r.l2.bottom <= r.texto.top + 1, "CORREA deve ficar acima do texto");
  await page.close();
});
