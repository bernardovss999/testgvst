// Bug original (30/10, no celular): o primeiro toque em "Media kit em PDF" mostrava "Não deu para gerar..." e só o
// segundo funcionava. A primeira geração acorda o servidor da Vercel (≈50 s, colado no limite de 60 s) e falhava.
// Junto: o PDF precisa sair SEMPRE com as fontes do site; antes, se o download delas falhasse, saía com letra genérica.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE } from "../servidor.js";

let servidor, browser;
before(async () => { servidor = await iniciar(0, { ler: SEM_REDE }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); servidor?.srv.close(); });

test("se a primeira chamada ao servidor falha, o botão tenta de novo e entrega o PDF sem mostrar erro", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  let chamadas = 0;
  await page.route(/\/api\/media-kit/, (r) => {
    chamadas++;
    if (chamadas === 1) return r.fulfill({ status: 504, contentType: "text/plain", body: "FUNCTION_INVOCATION_TIMEOUT" });
    return r.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4\n%%EOF" });
  });
  await page.goto(servidor.url);
  const textos = [];
  await page.exposeFunction("__aviso", (t) => textos.push(t));
  await page.evaluate(() => {
    // registra tudo o que o aviso mostra
    new MutationObserver(() => document.querySelectorAll("[role=status], .aviso, [aria-live]").forEach((el) => globalThis.__aviso(el.textContent)))
      .observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.evaluate(() => globalThis.GVST.gerarMediaKit());
  assert.equal(chamadas, 2);
  assert.ok(await page.evaluate(() => !!globalThis.GVST.ultimoPdf), "o PDF foi entregue");
  assert.ok(!textos.some((t) => /Não deu/.test(t)), `mostrou erro: ${textos.join(" | ")}`);
  await page.close();
});

test("o media kit é montado com as fontes do site (Archivo e Instrument Serif) carregadas e embutidas", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url + "index.html?pdf=1");
  const r = await page.evaluate(async () => {
    await globalThis.GVST.gerarPdfAqui();
    const css = await globalThis.GVST.fontesEmbutidas();
    return { lista: globalThis.GVST.FONTES_DO_SITE, css };
  });
  assert.deepEqual(r.lista, ["Archivo", "Instrument Serif"]);
  for (const f of r.lista) assert.ok(r.css.includes(`font-family: '${f}'`), `${f} não foi embutida`);
  assert.match(r.css, /url\(data:font\//);
  await page.close();
});

test("sem as fontes do site o media kit NÃO sai com letra genérica (vira erro e o servidor tenta de novo)", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(servidor.url + "index.html?pdf=1");
  const erro = await page.evaluate(() => globalThis.GVST.gerarPdfAqui().then(() => null, (e) => String(e.message)));
  assert.match(erro || "", /fontes do site/);
  await page.close();
});
