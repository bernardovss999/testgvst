// Modelo fixo do media kit (pedido do cliente, 29/10): o PDF aprovado é a base imutável de todos os próximos.
// Bug original: gerado num iPhone (Safari/WebKit) no próprio aparelho, o PDF saía quebrado (fotos e capas em branco,
// números "000.000", fonte sem a largura certa). Agora o arquivo vem sempre do servidor, no mesmo Chromium.
// Toda geração precisa repetir o modelo gravado em tests/modelo/media-kit-modelo.json; só os dados mudam.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, webkit } from "../playwright.js";
import { iniciar, SEM_REDE, RAIZ } from "../servidor.js";
import { limparCache } from "../../api/seguidores.mjs";

let servidor, outroServidor, browser, modelo;
// outros números de seguidores, para provar que só os dados mudam
const OUTROS_NUMEROS = async () => ({ instagram: { seguidores: 123456 }, tiktok: { seguidores: 234567 }, youtube: null });

before(async () => {
  servidor = await iniciar(0, { ler: SEM_REDE });
  outroServidor = await iniciar(0, { ler: OUTROS_NUMEROS });
  browser = await chromium.launch();
  modelo = JSON.parse(await readFile(join(RAIZ, "tests/modelo/media-kit-modelo.json"), "utf8"));
});
after(async () => { await browser?.close(); servidor?.srv.close(); outroServidor?.srv.close(); });

async function relatorio(base) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base + "index.html?pdf=1");
  const r = await page.evaluate(async () => {
    await globalThis.GVST.gerarPdfAqui();
    return { versao: globalThis.GVST.MODELO.versao, paginas: globalThis.GVST.relatorioPdf, total: document.querySelector('[data-metrica="total.seguidores"]').textContent };
  });
  await page.close();
  return r;
}

function confereModelo(r, origem) {
  assert.equal(r.versao, modelo.versao, `${origem}: versão do modelo mudou sem regravar o arquivo do modelo`);
  assert.deepEqual(r.paginas.map((p) => p.secoes), modelo.paginas.map((p) => p.secoes), `${origem}: o plano de páginas mudou`);
  r.paginas.forEach((p, i) => {
    assert.ok(Math.abs(p.escala - modelo.paginas[i].escala) <= 0.03, `${origem}, pág. ${i + 1} (${p.secoes}): escala ${p.escala.toFixed(3)} x modelo ${modelo.paginas[i].escala}`);
  });
}

test("o PDF gerado repete o modelo fixo aprovado (mesmas páginas, mesmas seções, mesma escala)", async () => {
  confereModelo(await relatorio(servidor.url), "geração");
});

test("só os dados mudam: com outros números de seguidores o modelo é o mesmo", async () => {
  limparCache();
  const a = await relatorio(servidor.url);
  limparCache(); // o cache de 15 s do contador é do processo inteiro
  const b = await relatorio(outroServidor.url);
  assert.notEqual(a.total, b.total, "os números precisam ser os do momento da geração");
  confereModelo(b, "com outros números");
});

test("/api/media-kit devolve o PDF pronto (gerado no servidor) com o nome do arquivo do dia", async () => {
  const r = await fetch(servidor.url + "api/media-kit");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  assert.match(r.headers.get("content-disposition"), /filename="media-kit-gustavo-correa-\d{4}-\d{2}-\d{2}\.pdf"/);
  const pdf = Buffer.from(await r.arrayBuffer());
  assert.ok(pdf.length < 4.5 * 1024 * 1024, `PDF com ${(pdf.length / 1048576).toFixed(1)} MB: a Vercel limita a resposta em 4,5 MB`);
  assert.equal((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length, modelo.paginas.length);
});

async function baixarNo(motor, rotaServidor) {
  const nav = await motor.launch();
  // "reduzir movimento": o contato entra animado (sobe e cresce) e o clique automático às vezes caía ao lado do
  // botão em movimento, sem nem pedir o PDF (o teste oscilava); com o botão parado o clique é sempre certeiro
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: motor !== chromium ? undefined : true, hasTouch: true, acceptDownloads: true, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const pedidos = [], diario = [];
  const t0 = Date.now(), marca = (o) => diario.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${o}`);
  page.on("request", (q) => { if (q.url().includes("/api/media-kit")) { pedidos.push(q.url()); marca("pedido ao servidor"); } });
  page.on("response", (q) => { if (q.url().includes("/api/media-kit")) marca(`resposta ${q.status()}`); });
  page.on("console", (m) => marca(`console ${m.type()}: ${m.text().slice(0, 140)}`));
  try {
    if (rotaServidor) await page.route(/\/api\/media-kit/, rotaServidor);
    await page.goto(servidor.url);
    // o que vier primeiro: o arquivo baixado ou o aviso de que não deu (lido antes de fechar o navegador)
    const baixou = page.waitForEvent("download", { timeout: 120000 })
      .then(async (d) => ({ pdf: (await readFile(await d.path())).toString("latin1"), aviso: "" }));
    const avisou = page.waitForFunction(() => /Não deu/.test(document.querySelector(".pdf-aviso__texto")?.textContent || ""), null, { timeout: 120000 })
      .then(async () => ({ pdf: null, aviso: await page.locator(".pdf-aviso__texto").textContent() }));
    baixou.catch(() => {}); avisou.catch(() => {});
    await page.locator(".contato__kit").click();
    marca("clique");
    const r = await Promise.race([baixou, avisou]);
    return { pedidos, arquivo: r.pdf, aviso: r.aviso };
  } catch (e) {
    throw new Error(`${e.message}\n${diario.join("\n")}`);
  } finally {
    await nav.close(); // sempre fecha, senão o processo de teste não termina
  }
}

test("no iPhone (WebKit) o botão busca o PDF no servidor, igual ao do computador", async () => {
  const r = await baixarNo(webkit);
  assert.equal(r.pedidos.length, 1, "o PDF precisa vir do servidor");
  assert.ok(r.arquivo, "o arquivo precisa ser entregue");
  assert.equal((r.arquivo.match(/\/Type\s*\/Page[^s]/g) || []).length, modelo.paginas.length);
});

test("servidor fora do ar: no iPhone avisa em vez de entregar um PDF quebrado; no Chrome monta igual no aparelho", async () => {
  const falha = (rota) => rota.fulfill({ status: 503, body: "{}", contentType: "application/json" });
  const iphone = await baixarNo(webkit, falha);
  assert.equal(iphone.arquivo, null, "WebKit não pode montar o PDF no aparelho");
  assert.match(iphone.aviso, /Não deu para gerar/);
  const android = await baixarNo(chromium, falha);
  assert.ok(android.arquivo, "no Chrome a reserva local gera o mesmo modelo");
});

// Bug original: as fontes eram baixadas sem prazo; com a rede engasgada a geração ficava parada para sempre
// (no servidor e no aparelho). Agora cada download tem prazo.
// Mudança de propósito (30/10, pedido do cliente): sem as fontes do site o PDF não sai mais com letra genérica;
// a geração termina dentro do prazo com erro claro, e o botão tenta de novo (media-kit-erro-na-primeira-vez).
test("Google Fonts sem responder: a geração termina dentro do prazo, com erro de fonte (sem PDF com letra errada)", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url + "index.html?pdf=1");
  await page.route(/fonts\.(googleapis|gstatic)\.com/, () => {}); // nunca responde
  const t0 = Date.now();
  const r = await page.evaluate(async () => {
    const erro = await globalThis.GVST.gerarPdfAqui().then(() => null, (e) => String(e.message));
    return { erro, prazo: globalThis.GVST.PRAZO_REDE };
  });
  const segundos = (Date.now() - t0) / 1000;
  assert.match(r.erro || "", /fontes do site|prazo esgotado/);
  assert.ok(segundos < r.prazo / 1000 + 25, `levou ${segundos.toFixed(0)} s`);
  await page.close();
});
