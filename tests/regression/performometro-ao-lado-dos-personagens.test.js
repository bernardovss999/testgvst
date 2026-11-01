// Pedido de 01/11: o Performômetro volta como 4ª coluna da seção Personagens (ao lado de um vídeo de cada personagem),
// e no celular a seção é curada: título → carrossel dos personagens → Performômetro → "Ver todos os personagens".
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

const medir = () => {
  const r = (el) => el.getBoundingClientRect();
  const cards = [...document.querySelectorAll("#personagem .persona-card")].map(r);
  const monte = document.getElementById("monte");
  const t = r(monte.querySelector(".monte__t"));
  return {
    cards: cards.map((c) => ({ x: Math.round(c.left), y: Math.round(c.top), w: Math.round(c.width), h: Math.round(c.height) })),
    monte: (({ left, top, width, height }) => ({ x: Math.round(left), y: Math.round(top), w: Math.round(width), h: Math.round(height) }))(r(monte)),
    tituloDentro: t.right <= r(monte).right + 1 && t.left >= r(monte).left - 1,
    titulo: r(document.getElementById("personagem-titulo")).top,
    botao: r(document.querySelector("#personagem .cabeca > .btn")),
    itens: [...monte.querySelectorAll(".item")].map((i) => Math.round(r(i).height)),
    lado: document.documentElement.scrollWidth - innerWidth,
    vw: innerWidth
  };
};

for (const [w, h] of [[1440, 900], [1280, 800]]) {
  test(`${w}px: Performômetro na 4ª coluna, na mesma fileira e da altura dos cards`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(medir);
    const ultimo = m.cards[2];
    assert.ok(m.monte.x > ultimo.x + ultimo.w, "à direita dos três personagens");
    assert.ok(Math.abs(m.monte.y - m.cards[0].y) <= 2 && Math.abs(m.monte.h - m.cards[0].h) <= 2, "mesma linha e mesma altura");
    assert.ok(m.monte.w >= 300, `coluna estreita demais: ${m.monte.w}px`);
    assert.ok(m.tituloDentro, "título PERFORMÔMETRO dentro da coluna");
    assert.equal(m.lado, 0);
    await page.close();
  });
}

for (const [w, h] of [[320, 640], [360, 780], [390, 844], [430, 932]]) {
  test(`${w}px: título → carrossel dos personagens → Performômetro → botão, tudo fácil de tocar`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(medir);
    assert.ok(m.titulo < m.cards[0].y && m.cards[0].y + m.cards[0].h <= m.monte.y && m.monte.y + m.monte.h <= m.botao.top, "ordem da seção no celular");
    assert.ok(m.cards[0].w >= m.vw * 0.5, `card pequeno demais: ${m.cards[0].w}px`);
    assert.ok(m.cards[1].x < m.vw && m.cards[1].x + 20 > m.cards[0].x + m.cards[0].w, "o próximo personagem aparece na borda (carrossel)");
    assert.ok(Math.min(...m.itens) >= 44, "botões do Performômetro com 44px ou mais");
    assert.ok(m.botao.width >= m.monte.w - 2 && m.botao.height <= 60, "botão na largura toda, em uma linha");
    assert.ok(m.tituloDentro);
    assert.equal(m.lado, 0, "sem rolagem lateral");
    await page.close();
  });
}
