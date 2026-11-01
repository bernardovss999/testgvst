// Bugs vistos no iPhone (01/11):
// - nos carrosséis (Personagens, Filmes...) o card era cortado na margem da página (títulos sem a 1ª letra);
// - o card fora de foco encolhia e o que entrava pela lateral ficava mais baixo e desfocado (vídeos desalinhados);
// - a seta "↗" dos links virava emoji azul no iPhone;
// - Números ao vivo e Links do Gustavo empilhados no celular; o cliente quer a disposição do computador
//   (três cartões lado a lado, compactos).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

const abrir = async (w, h) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  await page.goto(servidor.url);
  await page.evaluate(() => document.fonts.ready);
  return page;
};

for (const [w, h] of [[390, 844], [320, 640]]) {
  for (const sec of ["#personagem", "#filmes"]) {
    test(`${w}px ${sec}: carrossel na largura da tela e todos os vídeos do mesmo tamanho, na mesma linha`, async () => {
      const page = await abrir(w, h);
      await page.locator(`${sec} .grade-videos`).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500); // dá tempo para o autodeslize e as entradas
      const r = await page.evaluate((sel) => {
        const g = document.querySelector(`${sel} .grade-videos`);
        const b = g.getBoundingClientRect();
        const players = [...g.querySelectorAll(":scope > li .player")].map((p) => p.getBoundingClientRect());
        return {
          esq: b.left, dir: b.right, vw: innerWidth,
          alturas: new Set(players.map((p) => Math.round(p.height))).size,
          topos: new Set(players.map((p) => Math.round(p.top))).size,
          borrados: [...g.children].filter((li) => getComputedStyle(li).filter !== "none" || Number(getComputedStyle(li).opacity) < 1).length
        };
      }, sec);
      assert.ok(r.esq <= 1 && r.dir >= r.vw - 1, `carrossel cortado na margem (${r.esq}..${r.dir} de ${r.vw})`);
      assert.equal(r.alturas, 1, "vídeos de tamanhos diferentes");
      assert.equal(r.topos, 1, "vídeos fora da mesma linha");
      assert.equal(r.borrados, 0, "card apagado ou desfocado");
      await page.close();
    });
  }

  test(`${w}px: Números ao vivo, Links e cupons em três cartões lado a lado, sem texto vazando`, async () => {
    const page = await abrir(w, h);
    for (const sel of ["#numeros", "#links"]) { await page.locator(sel).scrollIntoViewIfNeeded(); await page.waitForTimeout(400); }
    const r = await page.evaluate(() => {
      const fileira = (sel) => {
        const rs = [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
        return { n: rs.length, topos: new Set(rs.map((x) => Math.round(x.top))).size, larguras: new Set(rs.map((x) => Math.round(x.width))).size };
      };
      const vazando = [".rede-card__nome", ".rede-card__num span", ".rede-card__cta", ".plat__nome", ".plat__num", ".plat__rotulo", ".cupom__marca", ".cupom__codigo span", ".cupom__copiar"]
        .flatMap((s) => [...document.querySelectorAll(s)]).filter((e) => e.offsetWidth && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
      const copiar = new Set([...document.querySelectorAll(".cupom__copiar")].map((b) => Math.round(b.getBoundingClientRect().top))).size;
      return { links: fileira(".redes-grandes > li"), numeros: fileira(".tabela-plat > .plat"), cupons: fileira(".cupons > .cupom"), vazando, copiar, lado: document.documentElement.scrollWidth - innerWidth };
    });
    for (const k of ["links", "numeros", "cupons"]) assert.deepEqual(r[k], { n: 3, topos: 1, larguras: 1 }, k);
    assert.deepEqual(r.vazando, []);
    assert.equal(r.copiar, 1, "'Copiar cupom' na mesma linha nos três cupons");
    assert.equal(r.lado, 0);
    await page.close();
  });
}

test("seta dos links é de texto (no iPhone virava emoji)", async () => {
  const page = await abrir(390, 844);
  const conteudo = await page.$eval(".video__link", (a) => getComputedStyle(a, "::after").content);
  assert.ok(conteudo.includes("︎"), `seta sem o seletor de texto: ${conteudo}`);
  await page.close();
});
