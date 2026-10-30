// Bug original: no topo, "GUSTAVO" e "CORREA" ficavam por cima do rosto e das pernas do Gustavo (a foto ficava "cortada" pelo texto).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

const sobrepoe = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;

async function medir(page) {
  return page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
    const img = document.querySelector(".hero__rosto");
    return { img: r(".hero__rosto"), l1: r(".hero__l1"), l2: r(".hero__l2"), lede: r(".hero__lede"), hero: r(".hero"), carregou: img.complete && img.naturalWidth > 0, vw: innerWidth };
  });
}

for (const [w, h] of [[1440, 900], [1920, 1000], [768, 1024], [375, 812]]) {
  test(`foto do Gustavo inteira e sem texto por cima em ${w}px`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const m = await medir(page);
    assert.ok(m.carregou, "imagem do topo não carregou");
    for (const k of ["l1", "l2", "lede"]) assert.ok(!sobrepoe(m.img, m[k]), `${k} está por cima da foto`);
    assert.ok(m.img.left >= -1 && m.img.right <= m.vw + 1, "foto cortada na lateral");
    assert.ok(m.img.top >= m.hero.top - 1, "foto cortada em cima");
    await page.close();
  });
}

// Bug: o "GVST" ficava atrás/na frente do nome e da foto e poluía o topo (1920px).
// Hoje o GVST é um selo fora do rosto: não pode encostar no nome, no texto, nos stickers nem no rosto.
for (const [w, h] of [[1920, 1000], [1440, 900], [390, 844]]) {
  test(`selo GVST não encosta no nome, no texto, nos stickers nem no rosto em ${w}px`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
      const mold = r(".retrato__moldura");
      // área do rosto: miolo da moldura (as bordas são fundo azul e cabelo)
      const rosto = { left: mold.left + mold.width * 0.2, right: mold.right - mold.width * 0.2, top: mold.top + mold.height * 0.15, bottom: mold.bottom - mold.height * 0.1 };
      return { selo: r(".selo"), l1: r(".hero__l1"), l2: r(".hero__l2"), lede: r(".hero__lede"), pov: r(".sticker--pov"), conceito: r(".sticker--conceito"), rosto, gvstAntigo: !!document.querySelector(".hero__gvst") };
    });
    assert.equal(m.gvstAntigo, false, "o GVST gigante atrás do nome/foto não deve voltar");
    for (const k of ["l1", "l2", "lede", "pov", "conceito", "rosto"]) assert.ok(!sobrepoe(m.selo, m[k]), `selo encosta em ${k}`);
    await page.close();
  });
}

// estilo usado só para provar que o detector de sobreposição funciona: põe o nome em cima do retrato
const NOME_SOBRE_FOTO = `.hero__titulo{position:absolute!important;left:55%;top:180px;z-index:9}`;
test("o teste pega o defeito quando o nome cobre a foto", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(servidor.url);
  await page.addStyleTag({ content: NOME_SOBRE_FOTO });
  const m = await medir(page);
  assert.ok(sobrepoe(m.img, m.l1) || sobrepoe(m.img, m.l2), "com o nome sobre a foto o detector deveria acusar");
  await page.close();
});
