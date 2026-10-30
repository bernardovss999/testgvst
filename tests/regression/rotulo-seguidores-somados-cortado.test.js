// Bug original: no celular o rótulo "Seguidores somados ao vivo" ficava cortado ("...AO VI"), porque era forçado
// numa linha só (nowrap) e não cabia na coluna; em 320px os outros rótulos da faixa também cortavam.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, webkit } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor;
const motores = [chromium, webkit].filter(Boolean);
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); });
after(() => { servidor?.srv.close(); });

for (const motor of motores) {
  test(`${motor.name()}: rótulos da faixa de seguidores inteiros no celular`, async () => {
    const browser = await motor.launch();
    try {
      for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932]]) {
        const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
        await page.goto(servidor.url);
        await page.evaluate(() => document.fonts.ready);
        const r = await page.evaluate(() => [...document.querySelectorAll(".faixa__item")].map((item) => {
          const rot = item.querySelector(".rotulo"), num = item.querySelector(".faixa__num");
          const caixa = item.getBoundingClientRect(), t = rot.getBoundingClientRect();
          return { texto: rot.textContent.trim(), sobra: rot.scrollWidth - rot.clientWidth, direita: t.right - caixa.right, num: Math.round(num.getBoundingClientRect().bottom) };
        }));
        for (const x of r) {
          assert.ok(x.sobra <= 0 && x.direita <= 1, `${w}px: "${x.texto}" cortado (${x.sobra}px a mais)`);
        }
        // números de cada fileira continuam alinhados
        assert.ok(Math.abs(r[0].num - r[1].num) <= 1 && Math.abs(r[2].num - r[3].num) <= 1, `${w}px: números desalinhados ${r.map((x) => x.num)}`);
        await page.close();
      }
    } finally { await browser.close(); }
  });
}
