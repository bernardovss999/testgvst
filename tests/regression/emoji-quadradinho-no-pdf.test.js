// Bug (01/11): no PDF gerado na Vercel os emojis saíam como quadradinhos (ex.: "💆🏾‍♂️" no Performômetro a 100%).
// A CSS da Noto Color Emoji do Google passou a vir sem os comentários /* [n] */ antes de cada @font-face e o
// mediakit.js separava os blocos por esses comentários: nenhuma fatia de emoji era embutida. No Windows a fonte de
// emoji do sistema escondia o defeito; o Chromium do servidor não tem fonte de emoji nenhuma.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

const faixas = (bloco) => ((bloco.match(/unicode-range:\s*([^;]+);/) || [])[1] || "").split(",").map((f) => {
  const r = f.trim().replace(/^U\+/i, "").split("-");
  return [parseInt(r[0], 16), parseInt(r[1] || r[0], 16)];
});

test("PDF embute a fonte de emoji para todo emoji da página (inclusive 💆🏾‍♂️ do Performômetro)", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url + "index.html?pdf=1");
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(async () => ({
    css: await globalThis.GVST.fontesEmbutidas(),
    emojis: [...new Set([...document.body.innerText].map((c) => c.codePointAt(0)).filter((c) => c >= 0x1F300))]
  }));
  const blocos = r.css.split("@font-face").slice(1).filter((b) => /Noto Color Emoji/.test(b));
  assert.ok(blocos.length > 0, "nenhuma fatia da fonte de emoji embutida");
  for (const b of blocos) assert.match(b, /url\(data:/, "fatia de emoji sem o arquivo embutido");
  const cobertos = blocos.flatMap(faixas);
  const faltam = r.emojis.filter((c) => !cobertos.some(([a, z]) => c >= a && c <= z)).map((c) => String.fromCodePoint(c));
  assert.deepEqual(faltam, [], "emojis sem fonte no PDF");
  assert.ok(r.emojis.includes(0x1F486), "o Performômetro montado (💆🏾‍♂️) está na página do PDF");
  await page.close();
});

test("blocos de fonte são separados com ou sem comentário antes de cada @font-face", async () => {
  const page = await browser.newPage();
  await page.goto(servidor.url);
  const n = await page.evaluate(() => {
    const sem = "@font-face { font-family: 'A'; unicode-range: U+1f486; }\n@font-face { font-family: 'A'; unicode-range: U+1f600; }";
    const com = "/* [0] */\n@font-face { font-family: 'A'; }\n/* latin */\n@font-face { font-family: 'B'; }";
    return [globalThis.GVST.blocosDeFonte(sem).length, globalThis.GVST.blocosDeFonte(com).length];
  });
  assert.deepEqual(n, [2, 2]);
  await page.close();
});
