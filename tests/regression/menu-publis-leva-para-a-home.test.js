// Pedido do cliente (29/10): "Publis" no menu da home levava à faixa de publis da própria home (#trabalhos),
// e não à página com todas as publis (publis.html).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RAIZ } from "../servidor.js";

const nav = (html) => html.match(/<nav class="nav" id="nav"[\s\S]*?<\/nav>/)[0];

for (const pagina of ["index.html", "publis.html"]) {
  test(`${pagina}: "Publis" no menu abre a página com todas as publis`, async () => {
    const html = await readFile(join(RAIZ, pagina), "utf8");
    const link = nav(html).match(/<a [^>]*>Publis<\/a>/)[0];
    assert.match(link, /href="publis\.html"/);
  });
}
