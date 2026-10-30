// Bug original: em rolagem muito rápida o IntersectionObserver pulava itens e eles ficavam invisíveis (opacidade 0).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

async function ocultosDepoisDoSalto(page) {
  await page.goto(servidor.url);
  await page.evaluate(() => { scrollTo({ top: document.body.scrollHeight, behavior: "instant" }); });
  await page.waitForTimeout(900);
  return page.evaluate(() => [...document.querySelectorAll(".revela:not(.is-visivel)")]
    .filter((el) => el.getBoundingClientRect().top < innerHeight).length);
}

test("pular direto pro fim revela tudo que ficou pra trás", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  assert.equal(await ocultosDepoisDoSalto(page), 0);
  await page.close();
});

test("o teste pega o defeito sem a rede de segurança da rolagem", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route("**/assets/js/main.js", async (route) => {
    const r = await route.fetch();
    const js = (await r.text()).replace(/\/\/ rede de segurança[\s\S]*?\{ passive: true \}\);/, "");
    await route.fulfill({ response: r, body: js });
  });
  assert.ok(await ocultosDepoisDoSalto(page) > 0, "sem a correção, itens deveriam ficar ocultos");
  await page.close();
});
