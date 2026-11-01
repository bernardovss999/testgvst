// Pedido de 01/11: o PDF do media kit se chama "Gustavo Correa Media kit.pdf" (antes era
// "media-kit-gustavo-correa-AAAA-MM-DD.pdf"), venha do servidor ou do próprio aparelho.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";
import { nomeDoArquivo } from "../../api/media-kit-core.mjs";

const NOME = "Gustavo Correa Media kit.pdf";
let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

test("servidor (Vercel e local): nome padrão do arquivo", async () => {
  assert.equal(nomeDoArquivo(), NOME);
  const r = await fetch(servidor.url + "api/media-kit");
  assert.equal(r.headers.get("content-disposition"), `attachment; filename="${NOME}"`);
});

test("gerado no aparelho (reserva do botão): mesmo nome", async () => {
  const page = await browser.newPage();
  await page.goto(servidor.url);
  assert.equal(await page.evaluate(() => globalThis.GVST.nomeArquivo()), NOME);
  await page.close();
});
