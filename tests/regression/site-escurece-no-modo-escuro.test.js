// Pedido do cliente (30/10): o site precisa ficar igual no modo claro e no modo escuro, no computador e no celular.
// Bug original: sem declarar o esquema de cor, o modo escuro automático do navegador (Chrome no Android, Samsung
// Internet) invertia a página: fundo escuro, texto claro, cartões trocados. Agora o site declara "only light".
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, claro, escuro;
before(async () => {
  servidor = await iniciar(0, { ler: SEM_REDE });
  claro = await chromium.launch();
  // o mesmo escurecimento automático que o Chrome aplica quando o aparelho está no modo escuro
  escuro = await chromium.launch({ args: ["--blink-settings=forceDarkModeEnabled=true"] });
});
after(async () => { await claro?.close(); await escuro?.close(); servidor?.srv.close(); });

async function foto(browser, esquema, pagina, [w, h]) {
  const celular = w < 700;
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: esquema, reducedMotion: "reduce", isMobile: celular, hasTouch: celular });
  await page.goto(servidor.url + pagina);
  await page.evaluate(() => document.fonts.ready);
  // só a área de conteúdo estático (sem vídeo do fundo nem contador)
  await page.evaluate(() => { const c = document.getElementById("contato"); if (c) window.scrollTo({ top: c.offsetTop, behavior: "instant" }); });
  await page.waitForTimeout(600);
  const png = await page.screenshot();
  const esquemaCss = await page.evaluate(() => ({
    meta: document.querySelector('meta[name="color-scheme"]')?.content,
    css: getComputedStyle(document.documentElement).colorScheme
  }));
  await page.close();
  return { png, ...esquemaCss };
}

for (const pagina of ["", "publis.html"]) {
  for (const tela of [[390, 844], [1440, 900]]) {
    test(`${pagina || "index.html"} em ${tela.join("x")}: igual no modo claro e no modo escuro`, async () => {
      const a = await foto(claro, "light", pagina, tela);
      const b = await foto(escuro, "dark", pagina, tela);
      assert.equal(b.meta, "only light");
      assert.match(b.css, /^(only light|light only)$/); // o navegador devolve na ordem dele
      assert.ok(a.png.equals(b.png), "a página muda de cor no modo escuro");
    });
  }
}
