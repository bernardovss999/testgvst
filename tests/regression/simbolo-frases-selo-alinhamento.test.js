// Pedido do cliente: tirar o símbolo ✦ (parecia o do Gemini) do site todo, remover as mini frases
// ("toca aqui", "atualiza sozinho", "aperta o play"), deixar o GVST do selo parado (só o anel gira)
// e subir o conteúdo das seções (estava centralizado demais), no desktop e no mobile.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE, RAIZ } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

const SIMBOLOS_PROIBIDOS = /[✦✧✨⭐★☆✶✷✸✹]/;

test("símbolo ✦ não aparece em nenhum arquivo do site", async () => {
  for (const arq of ["index.html", "assets/css/style.css", "assets/css/mobile.css", "assets/js/main.js", "scripts/gerar-publis.py"]) {
    const txt = await readFile(join(RAIZ, arq), "utf8");
    assert.doesNotMatch(txt, SIMBOLOS_PROIBIDOS, arq);
  }
});

test("símbolo ✦ não aparece na página renderizada (nem via CSS)", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const achados = await page.evaluate((fonte) => {
    const re = new RegExp(fonte);
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      for (const pseudo of ["::before", "::after"]) {
        const c = getComputedStyle(el, pseudo).content;
        if (c && re.test(c)) out.push(`${el.className}${pseudo}`);
      }
      if ([...el.childNodes].some((n) => n.nodeType === 3 && re.test(n.textContent))) out.push(el.className || el.tagName);
    }
    return out.slice(0, 5);
  }, SIMBOLOS_PROIBIDOS.source);
  assert.deepEqual(achados, []);
  await page.close();
});

test("mini frases debaixo dos títulos foram removidas", async () => {
  const html = await readFile(join(RAIZ, "index.html"), "utf8");
  assert.ok(!html.includes("sticker--titulo"));
  for (const frase of ["toca aqui", "atualiza sozinho", "aperta o play"]) assert.ok(!html.includes(frase), frase);
});

test("selo: o anel de texto gira e o GVST do centro fica parado", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const r = await page.evaluate(() => ({
    selo: getComputedStyle(document.querySelector(".selo")).animationName,
    anel: getComputedStyle(document.querySelector(".selo__anel")).animationName,
    centroDentroDoAnel: !!document.querySelector(".selo__anel .selo__centro"),
    centro: document.querySelector(".selo__centro").textContent
  }));
  assert.equal(r.selo, "none", "o selo inteiro não pode girar");
  assert.equal(r.anel, "girar");
  assert.equal(r.centroDentroDoAnel, false);
  assert.equal(r.centro, "GVST");
  // medição real (depois da animação de entrada do retrato): o centro não muda de posição com o tempo
  await page.waitForTimeout(1600);
  const pos = () => page.$eval(".selo__centro", (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width)]; });
  const a = await pos(); await page.waitForTimeout(1200); const b = await pos();
  assert.deepEqual(a, b);
  await page.close();
});

for (const [nome, w, h, max] of [["desktop", 1440, 900, 100], ["mobile", 390, 844, 60]]) {
  test(`${nome}: título de cada seção fica perto do topo da seção (até ${max}px)`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    const longe = await page.evaluate(() => [...document.querySelectorAll("section.secao")].map((sec) => {
      const t = sec.querySelector(".rotulo, .titulo");
      return [sec.id, Math.round(t.getBoundingClientRect().top - sec.getBoundingClientRect().top)];
    }));
    const ruins = longe.filter(([, d]) => d > max);
    assert.deepEqual(ruins, [], JSON.stringify(longe));
    await page.close();
  });
}

// Pedido do cliente: nada de travessão (—/–) nem das barrinhas decorativas que entraram no lugar do ✦.
test("nenhum travessão no texto, nos links e nas barrinhas decorativas", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const travessao = /[—–]/;
    const textos = [...document.querySelectorAll("body *")]
      .filter((el) => !el.closest("script, style") && [...el.childNodes].some((n) => n.nodeType === 3 && travessao.test(n.textContent)))
      .map((el) => el.className || el.tagName);
    const ler = (v) => { try { return decodeURIComponent(v); } catch { return v; } };
    const atributos = [...document.querySelectorAll("[href], [alt], [aria-label], [title]")]
      .filter((el) => ["href", "alt", "aria-label", "title"].some((a) => travessao.test(ler(el.getAttribute(a) || ""))))
      .map((el) => el.className || el.tagName);
    const barrinhas = [...document.querySelectorAll(".rotulo, .marcas-topo__titulo")].filter((el) => {
      const b = getComputedStyle(el, "::before");
      return b.content !== "none" && b.content !== "normal" && parseFloat(b.width) > 0;
    }).map((el) => el.className);
    return { textos, atributos, barrinhas: [...new Set(barrinhas)] };
  });
  assert.deepEqual(r, { textos: [], atributos: [], barrinhas: [] });
  await page.close();
});
