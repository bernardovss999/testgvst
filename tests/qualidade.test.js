// Acessibilidade (axe-core) e orçamento de desempenho no carregamento.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, caminhoAxe } from "./playwright.js";
import { iniciar, SEM_REDE } from "./servidor.js";

let servidor, browser, axe;
before(async () => {
  servidor = await iniciar(0, { ler: SEM_REDE });
  browser = await chromium.launch();
  axe = await readFile(caminhoAxe(), "utf8");
});
after(async () => { await browser?.close(); servidor?.srv.close(); });

for (const [nome, w, h] of [["desktop", 1440, 900], ["mobile", 375, 812]]) {
  test(`acessibilidade (axe, WCAG A/AA): sem violações graves ou críticas (${nome})`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(servidor.url);
    await page.addScriptTag({ content: axe });
    const res = await page.evaluate(async () => (await globalThis.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`));
    assert.deepEqual(res, []);
    await page.close();
  });
}

// Conta cada arquivo uma vez: as cópias do loop da vitrine usam o mesmo vídeo e o navegador reaproveita o cache
test("desempenho: carregamento inicial dentro do orçamento (arquivos únicos)", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com|tiktok|instagram/, (r) => r.abort());
  const arquivos = new Map();
  page.on("response", async (resp) => {
    try {
      const url = resp.url().split("?")[0];
      const corpo = await resp.body();
      arquivos.set(url, Math.max(arquivos.get(url) || 0, corpo.length));
    } catch { /* respostas sem corpo */ }
  });
  await page.goto(servidor.url, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const total = [...arquivos.values()].reduce((a, b) => a + b, 0);
  const mb = total / 1024 / 1024;
  const maiores = [...arquivos].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, b]) => `${n.split("/").pop()} ${(b / 1024).toFixed(0)}KB`).join(", ");
  assert.ok(mb < 3, `carregou ${mb.toFixed(2)} MB em arquivos únicos (maiores: ${maiores})`);
  const videos = [...arquivos.keys()].filter((u) => /\/assets\/video\/.+\.(mp4|webm)$/.test(u));
  assert.ok(videos.length >= 10, `só ${videos.length} vídeos da vitrine carregaram`);
  await page.close();
});

test("desempenho: layout estável (CLS < 0,1) e LCP rápido no servidor local", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    globalThis.__cls = 0;
    globalThis.__lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) globalThis.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) globalThis.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(servidor.url, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const { cls, lcp } = await page.evaluate(() => ({ cls: globalThis.__cls, lcp: globalThis.__lcp }));
  assert.ok(cls < 0.1, `CLS ${cls.toFixed(3)}`);
  assert.ok(lcp > 0 && lcp < 2500, `LCP ${lcp.toFixed(0)} ms`);
  await page.close();
});

test("imagens fora da primeira tela carregam sob demanda", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const imgs = html.match(/<img\b[^>]*>/g);
  const semLazy = imgs.filter((t) => !/loading="lazy"/.test(t));
  assert.ok(semLazy.length <= 1, `imagens sem lazy: ${semLazy.join("\n")}`);
  assert.match(semLazy[0] || "", /hero__rosto[^>]*fetchpriority="high"/, "só o retrato do topo carrega de imediato, com prioridade alta");
});
