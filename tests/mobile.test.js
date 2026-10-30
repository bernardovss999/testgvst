// Mobile: celulares de 320 a 430px, toque, leitura, carrosséis, barra fixa e vibe performática.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "./playwright.js";
import { iniciar, SEM_REDE } from "./servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

const CELULARES = { "iPhone SE (320)": [320, 568], "Galaxy (360)": [360, 780], "iPhone 14 (390)": [390, 844], "Pro Max (430)": [430, 932] };
const abrir = async (w, h, extra = {}, caminho = "") => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: "reduce", ...extra });
  await page.goto(servidor.url + caminho);
  await page.evaluate(() => document.fonts.ready);
  return page;
};

for (const [nome, [w, h]] of Object.entries(CELULARES)) {
  test(`${nome}: nada vaza para os lados`, async () => {
    const page = await abrir(w, h);
    const r = await page.evaluate(() => {
      const fora = [...document.querySelectorAll("body *")].filter((el) => {
        if (el.closest("[aria-hidden=true], .grade-videos, .marca__videos, .carrossel, .galeria, .ticker, .letreiro, .vitrine, .skip, .sprite")) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      }).map((el) => el.className || el.tagName).slice(0, 5);
      return { largura: document.documentElement.scrollWidth, fora };
    });
    assert.ok(r.largura <= w, `rolagem lateral: ${r.largura}px`);
    assert.deepEqual(r.fora, []);
    await page.close();
  });

  test(`${nome}: toda área de toque visível tem pelo menos 44px`, async () => {
    const page = await abrir(w, h);
    const pequenos = await page.evaluate(() => [...document.querySelectorAll("a, button")]
      .filter((el) => !el.closest("[aria-hidden=true], .skip, .dock:not(.is-visivel)"))
      .filter((el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && s.visibility !== "hidden"; })
      .filter((el) => { const r = el.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; })
      .map((el) => `${el.className || el.tagName} "${el.textContent.trim().slice(0, 20)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)
      .slice(0, 8));
    assert.deepEqual(pequenos, []);
    await page.close();
  });

  test(`${nome}: nenhum texto legível abaixo de 11px e nenhum título vazando`, async () => {
    const page = await abrir(w, h);
    const r = await page.evaluate(() => {
      const textos = [...document.querySelectorAll("body *")].filter((el) => !el.closest("[aria-hidden=true]") && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
      const miudos = textos.filter((el) => el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.className || el.tagName);
      const titulos = [...document.querySelectorAll(".titulo, .hero__titulo, .contato__titulo, .soma__num, .plat__num")].filter((el) => {
        const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect().right > innerWidth + 1;
      }).map((el) => el.textContent.trim());
      return { miudos: [...new Set(miudos)], titulos };
    });
    assert.deepEqual(r.miudos, []);
    assert.deepEqual(r.titulos, []);
    await page.close();
  });
}

test("cartões de rede: nome e botão de seguir não se sobrepõem", async () => {
  const page = await abrir(360, 780);
  const batidas = await page.$$eval(".rede-card", (cards) => cards.filter((c) => {
    const a = c.querySelector(".rede-card__nome").getBoundingClientRect();
    const b = c.querySelector(".rede-card__cta").getBoundingClientRect();
    return a.right > b.left + 1 && a.left < b.right && a.top < b.bottom && a.bottom > b.top;
  }).map((c) => c.querySelector(".rede-card__nome").textContent));
  assert.deepEqual(batidas, []);
  await page.close();
});

test("carrosséis do mobile deslizam e mostram um pedaço do próximo item", async () => {
  const page = await abrir(390, 844);
  const r = await page.evaluate(() => [".grade-videos", ".galeria"].map((sel) => {
    const el = document.querySelector(sel);
    const s = getComputedStyle(el);
    const segundo = el.children[1].getBoundingClientRect();
    return { sel, rola: el.scrollWidth > el.clientWidth, snap: s.scrollSnapType.startsWith("x"), proximoAparece: segundo.left < innerWidth };
  }));
  for (const c of r) assert.ok(c.rola && c.snap && c.proximoAparece, JSON.stringify(c));
  await page.close();
});

test("publis no mobile: cada vídeo ocupa menos de meia tela de largura e a marca tem cabeçalho compacto", async () => {
  const page = await abrir(390, 844, {}, "publis.html");
  const rola = await page.$eval(".marca__videos", (el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).scrollSnapType.startsWith("x"));
  assert.ok(rola, "vídeos da marca deslizam na horizontal");
  const r = await page.evaluate(() => {
    const v = document.querySelector(".marca__videos .video").getBoundingClientRect();
    const info = document.querySelector(".marca__info").getBoundingClientRect();
    return { largura: v.width, alturaCabecalho: info.height };
  });
  assert.ok(r.largura < 195, `vídeo com ${r.largura}px`);
  assert.ok(r.alturaCabecalho < 360, `cabeçalho da marca com ${r.alturaCabecalho}px`);
  await page.close();
});

test("barra fixa: escondida no topo, aparece ao rolar, some no contato e não cobre o rodapé", async () => {
  const page = await abrir(390, 844);
  const visivel = () => page.evaluate(() => document.getElementById("dock").classList.contains("is-visivel"));
  assert.equal(await visivel(), false, "não pode aparecer em cima do topo");
  await page.evaluate(() => scrollTo({ top: document.getElementById("personagem").offsetTop, behavior: "instant" }));
  await page.waitForTimeout(150);
  assert.equal(await visivel(), true, "deve aparecer depois do topo");
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(150);
  assert.equal(await visivel(), false, "deve sumir no contato");
  const cta = await page.$eval(".dock__cta", (a) => a.getAttribute("href"));
  assert.equal(cta, "#contato");
  await page.close();
});

test("barra fixa não existe no desktop", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  assert.equal(await page.$eval("#dock", (d) => getComputedStyle(d).display), "none");
  await page.close();
});

test("vibe performática: o nível de performance enche de 0% a 100% com a rolagem", async () => {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(servidor.url);
    const ler = () => page.evaluate(() => ({ num: document.getElementById("performance-num").textContent, selo: document.getElementById("performance-selo").classList.contains("is-visivel") }));
    assert.deepEqual(await ler(), { num: "0%", selo: false });
    await page.evaluate(() => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) / 2, behavior: "instant" }));
    await page.waitForTimeout(150);
    const meio = await ler();
    assert.ok(/^(4[5-9]|5[0-5])%$/.test(meio.num) && meio.selo, `meio da página: ${JSON.stringify(meio)}`);
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(150);
    assert.equal((await ler()).num, "100%");
    await page.close();
  }
});

test("no celular, todos os vídeos do fundo do topo tocam sozinhos", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(servidor.url);
  await page.waitForFunction(() => { const v = [...document.querySelectorAll(".vitrine video")]; return v.length && v.every((x) => !x.paused); }, null, { timeout: 15000 });
  await page.close();
});

test("player abre o vídeo na íntegra dentro do card no celular", async () => {
  const page = await abrir(390, 844, {}, "publis.html");
  await page.route(/tiktok\.com|instagram\.com/, (r) => r.fulfill({ body: "<html></html>", contentType: "text/html" }));
  const p = page.locator(".marca__videos .player").first();
  await p.scrollIntoViewIfNeeded();
  await p.locator("button").tap();
  const box = await p.locator("iframe").boundingBox();
  assert.ok(box && box.width > 120 && box.height > 200, `iframe ${JSON.stringify(box)}`);
  await page.close();
});

test("menu do celular: opções entram animadas, uma depois da outra, e terminam visíveis", async () => {
  const page = await abrir(390, 844, { reducedMotion: "no-preference" });
  await page.locator("#menu-btn").click();
  const r = await page.$$eval("#nav a", (as) => as.map((a) => { const s = getComputedStyle(a); return { nome: s.animationName, atraso: parseFloat(s.animationDelay) }; }));
  assert.equal(await page.$eval("#nav", (n) => getComputedStyle(n).animationName), "menu-painel");
  assert.ok(r.every((o) => o.nome === "menu-opcao"), JSON.stringify(r));
  assert.ok(r.every((o, i) => i === 0 || o.atraso > r[i - 1].atraso), "cada opção entra depois da anterior");
  await page.waitForTimeout(900);
  const fim = await page.$$eval("#nav a", (as) => as.map((a) => { const s = getComputedStyle(a); return s.opacity + " " + s.transform; }));
  assert.ok(fim.every((f) => f === "1 none"), JSON.stringify(fim));
  await page.close();
});

test("menu: sem animação no desktop e com 'reduzir movimento'", async () => {
  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desk.goto(servidor.url);
  assert.deepEqual([...new Set(await desk.$$eval("#nav, #nav a", (els) => els.map((e) => getComputedStyle(e).animationName)))], ["none"]);
  await desk.close();
  const page = await abrir(390, 844);
  await page.locator("#menu-btn").click();
  assert.deepEqual([...new Set(await page.$$eval("#nav, #nav a", (els) => els.map((e) => getComputedStyle(e).animationName)))], ["none"]);
  await page.close();
});
