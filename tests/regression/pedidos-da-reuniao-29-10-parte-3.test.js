// Terceira rodada (29/10): faixas não param com o mouse, menu começa em "Início", sublinhado colado em "lifestyle"
// sem passar no "y", POV "Pov performático", faixa de seguidores na largura toda com logos sem fundo, rótulos pretos
// e "somados ao vivo" numa linha, mais vistos embaixo da audiência e media kit em PDF igual ao desktop do site
// (sem cabeçalho, com a data de atualização no canto superior direito), gerado do mesmo jeito no celular e no computador.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "../playwright.js";
import { iniciar, SEM_REDE, RAIZ } from "../servidor.js";

let servidor, browser, html;
before(async () => {
  servidor = await iniciar(0, { ler: SEM_REDE });
  browser = await chromium.launch();
  html = await readFile(join(RAIZ, "index.html"), "utf8");
});
after(async () => { await browser?.close(); servidor?.srv.close(); });

test("marcas e publis continuam passando com o mouse em cima", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  for (const [area, trilho] of [[".marcas-topo .letreiro", ".marcas-topo .letreiro__trilho"], [".carrossel", ".carrossel__trilho"]]) {
    await page.locator(area).scrollIntoViewIfNeeded();
    await page.locator(area).hover();
    await page.waitForTimeout(150);
    assert.equal(await page.$eval(trilho, (t) => getComputedStyle(t).animationPlayState), "running", `${area} parou no hover`);
  }
  await page.close();
});

// 01/11: "Personagem" virou "Personagens" e entrou "Filmes" (pedido do cliente; ver personagens-e-filmes.test.js)
test("menu: Início, Links, Sobre, Personagens, Filmes, Números, Publis, Audiência", async () => {
  for (const arq of ["index.html", "publis.html", "personagens.html", "media-kit.html"]) {
    const pagina = await readFile(join(RAIZ, arq), "utf8");
    const nav = pagina.split('id="nav"')[1].split("</nav>")[0];
    const itens = [...nav.matchAll(/<a (?!class="nav__cta")[^>]*>([^<]+)</g)].map((m) => m[1]);
    assert.deepEqual(itens, ["Início", "Links", "Sobre", "Personagens", "Filmes", "Números", "Publis", "Audiência"], arq);
  }
});

// Bugs originais: o traço atravessava o "y" (e, antes de medir a fonte, a palavra inteira); depois ficou longe demais.
// Pedido final: traço redondo e ondulado, colado embaixo de "lifestyle", que só no "y" faz uma volta por baixo da perna.
for (const [w, h] of [[1440, 900], [390, 844]]) {
  test(`sublinhado de 'lifestyle' em ${w}px: colado embaixo, ondulado e com a volta só sob o 'y'`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelector(".hero__lede .rabisco.is-medido"));
    const r = await page.$eval(".hero__lede .destaque", (em) => {
      const svg = em.querySelector(".rabisco"), path = svg.querySelector("path");
      const fonte = parseFloat(getComputedStyle(em).fontSize);
      const base = parseFloat(svg.dataset.base), cauda = parseFloat(svg.dataset.cauda);
      const total = path.getTotalLength();
      const pts = Array.from({ length: 240 }, (_, i) => path.getPointAtLength((total * i) / 239));
      const fora = pts.filter((p) => Math.abs(p.x - cauda) > fonte * 0.55);
      const perto = pts.filter((p) => Math.abs(p.x - cauda) <= fonte * 0.1);
      const texto = em.firstChild, rg = document.createRange();
      rg.setStart(texto, 0); rg.setEnd(texto, texto.length);
      const larguraTexto = rg.getBoundingClientRect().width;
      return {
        visivel: getComputedStyle(svg).visibility === "visible" && getComputedStyle(svg).display !== "none",
        acimaDaBase: Math.min(...fora.map((p) => p.y)) - base,                // a linha nunca sobe para dentro das letras
        abaixoDaBase: Math.max(...fora.map((p) => p.y)) - base,               // e fica colada (não longe demais)
        volta: Math.max(...perto.map((p) => p.y)) - base,                      // sob o "y" ela desce bem mais
        variacao: Math.max(...fora.map((p) => p.y)) - Math.min(...fora.map((p) => p.y)),
        cobre: (pts[pts.length - 1].x - pts[0].x) / larguraTexto,
        fonte
      };
    });
    const em = (v) => (v / r.fonte).toFixed(2) + "em";
    assert.ok(r.visivel);
    assert.ok(r.acimaDaBase > 0.05 * r.fonte, `traço sobe até ${em(r.acimaDaBase)} da base: atravessa as letras`);
    assert.ok(r.abaixoDaBase < 0.3 * r.fonte, `traço desce ${em(r.abaixoDaBase)}: longe demais da palavra`);
    assert.ok(r.volta > 0.38 * r.fonte, `volta sob o 'y' só desce ${em(r.volta)}`);
    assert.ok(r.variacao > 0.04 * r.fonte, "o traço precisa ondular, não ser uma régua");
    assert.ok(r.cobre > 0.9, `traço cobre só ${(r.cobre * 100).toFixed(0)}% da palavra`);
    await page.close();
  });
}

test("o traço não aparece antes de ser medido (o desenho padrão atravessava a palavra)", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/main\.js/, (r) => r.fulfill({ body: "", contentType: "text/javascript" }));
  await page.goto(servidor.url);
  assert.equal(await page.$eval(".hero__lede .rabisco", (s) => getComputedStyle(s).visibility), "hidden");
  await page.close();
});

test("legenda da foto: 'Pov performático'", () => {
  assert.match(html, /class="sticker sticker--pov" aria-hidden="true">Pov performático<\/p>/);
});

for (const [w, h] of [[1920, 970], [1440, 900], [1024, 768], [390, 844], [320, 568]]) {
  test(`faixa de seguidores em ${w}px: largura toda, logos sem fundo, rótulos pretos e uma linha só`, async () => {
    const celular = w < 700;
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: celular, hasTouch: celular });
    await page.goto(servidor.url);
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const faixa = document.querySelector(".faixa");
      const fundo = getComputedStyle(faixa, "::before");
      const largura = parseFloat(fundo.width);
      const blur = parseFloat((fundo.backdropFilter.match(/blur\(([\d.]+)px\)/) || [])[1]);
      const icones = [...document.querySelectorAll(".faixa__ico")].map((i) => getComputedStyle(i).backgroundColor);
      const rotulos = [...faixa.querySelectorAll(".rotulo")].map((r) => {
        const s = getComputedStyle(r);
        return { cor: s.color, linhas: Math.round(r.getBoundingClientRect().height / parseFloat(s.lineHeight || s.fontSize)), texto: r.textContent.trim(), direita: r.getBoundingClientRect().right };
      });
      return { largura, vw: document.documentElement.clientWidth, blur, icones, rotulos, rolagem: document.documentElement.scrollWidth };
    });
    assert.ok(r.largura >= r.vw, `fundo da faixa com ${r.largura}px numa tela de ${r.vw}px`);
    assert.ok(r.blur >= 4 && r.blur <= 14, `blur de ${r.blur}px: o vídeo do fundo precisa continuar aparecendo`);
    assert.ok(r.icones.every((c) => c === "rgba(0, 0, 0, 0)"), `ícones com fundo: ${r.icones}`);
    for (const rot of r.rotulos) {
      assert.equal(rot.cor, "rgb(0, 0, 0)", `${rot.texto} não está preto`);
      // uma linha só no computador e no tablet; no celular (≤ 640px) o rótulo pode ir para duas linhas, porque em uma
      // ele ficava cortado ("...AO VI", pedido de 29/10; ver rotulo-seguidores-somados-cortado.test.js)
      assert.ok(rot.linhas <= (w <= 640 ? 2 : 1), `${rot.texto} quebrou em ${rot.linhas} linhas`);
      assert.ok(rot.direita <= w + 1, `${rot.texto} vazou da tela`);
    }
    assert.ok(r.rolagem <= w, `rolagem lateral: ${r.rolagem}px`);
    await page.close();
  });
}

test("cada logo da faixa está na cor da rede", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const r = await page.evaluate(() => {
    const ps = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo);
    return {
      instagram: ps(".faixa__ico--instagram", "::before").backgroundImage,
      tiktok: ps(".faixa__ico--tiktok svg").filter,
      youtube: ps(".faixa__ico--youtube", "::before").backgroundImage,
      grupo: ps(".faixa__ico--grupo svg").color
    };
  });
  assert.match(r.instagram, /radial-gradient/);
  assert.match(r.tiktok, /rgb\(37, 244, 238\)[\s\S]*rgb\(254, 44, 85\)/);
  assert.match(r.youtube, /rgb\(2\d\d, \d{1,2}, \d{1,2}\)/);
  assert.equal(r.grupo, "rgb(93, 123, 208)");
  await page.close();
});

test("mais vistos do TikTok ficam embaixo da audiência", () => {
  const pos = (s) => { const i = html.indexOf(s); assert.ok(i > 0, s); return i; };
  assert.ok(pos('id="audiencia"') < pos('class="mais-vistos"') && pos('class="mais-vistos"') < pos('id="agencia"'));
  const sobre = html.split('id="sobre"')[1].split("</section>")[0];
  assert.ok(!sobre.includes("mais-vistos"));
});

// O PDF não pode depender do diálogo de impressão (no Windows ele saía no layout de tablet, em 15 folhas):
// o botão monta o arquivo a partir de uma cópia da home em 1440 x 900.
async function gerarPdf(w, h) {
  const celular = w < 700;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: celular, hasTouch: celular, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  await page.goto(servidor.url);
  const download = page.waitForEvent("download", { timeout: 120000 });
  await page.locator(".contato__kit").click();
  const d = await download;
  const pdf = (await readFile(await d.path())).toString("latin1");
  await ctx.close();
  const tamanhos = [...pdf.matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map((m) => [Math.round(m[1]), Math.round(m[2])]);
  const links = [...pdf.matchAll(/\/URI\s*\(([^)]*)\)/g)].map((m) => m[1]);
  return { nome: d.suggestedFilename(), paginas: (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, tamanhos, links, erros };
}

for (const [w, h] of [[1440, 900], [390, 844]]) {
  // padrão do media kit: A4 deitado, cada seção começa numa página nova (as altas continuam na seguinte)
  test(`media kit em PDF gerado pelo botão em ${w}px: A4 deitado, seções em páginas próprias, links e sem erros`, async () => {
    const r = await gerarPdf(w, h);
    assert.match(r.nome, /^media-kit-gustavo-correa-\d{4}-\d{2}-\d{2}\.pdf$/);
    const secoes = (html.split("<main")[1].split("</main>")[0].match(/\n    <section /g) || []).length;
    // seção curta divide a página com a seguinte (MUDAH + contato), as altas podem continuar na seguinte
    assert.ok(r.paginas >= secoes - 2 && r.paginas <= secoes * 2, `${r.paginas} páginas para ${secoes} seções`);
    for (const [pw, ph] of r.tamanhos) {
      assert.equal(pw, 1440, "largura do desktop");
      assert.ok(Math.abs(ph / pw - 210 / 297) < 0.01, "A4 deitado");
    }
    // links clicáveis: marcas -> publis da marca, "Ver todas as publis", redes, cupons, contato comercial e vídeos
    const tem = (re, o) => assert.ok(r.links.some((u) => re.test(u)), `PDF sem link para ${o}`);
    tem(/publis\.html#marca-tv-globo$/, "a TV Globo nas publis");
    tem(/publis\.html#marca-tuyo$/, "a Tuyo nas publis");
    tem(/publis\.html$/, "a página de publis");
    tem(/^https:\/\/www\.instagram\.com\/gvstavocorrea\/$/, "o Instagram");
    tem(/^https:\/\/www\.tiktok\.com\/@gvstavoccorrea$/, "o TikTok");
    tem(/^https:\/\/www\.youtube\.com\/@gvstavocorrea$/, "o YouTube");
    tem(/^mailto:gustavo@agmoots\.com/, "o contato comercial");
    tem(/zerezes\.com\.br/, "a loja do cupom Zerezes");
    tem(/tiktok\.com\/@gvstavoccorrea\/video\/\d+/, "os vídeos");
    assert.ok(!r.links.some((u) => /localhost|127\.0\.0\.1/.test(u) && /#(contato)$/.test(u)), "'Enviar proposta' abre o e-mail");
    assert.deepEqual(r.erros, []);
  });
}

// Desde 29/10 o plano de páginas é o MODELO FIXO (assets/js/mediakit.js); a conferência completa contra o modelo
// gravado fica em tests/regression/media-kit-modelo-fixo.test.js
test("páginas do PDF: uma por item do modelo, seção inteira, largura toda e rodapé com o contato", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url + "index.html?pdf=1");
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const G = globalThis.GVST;
    return G.paginasDoKit().map((grupo) => {
      const altura = grupo.reduce((t, el) => t + el.offsetHeight, 0);
      return { id: grupo[0].id || grupo[0].className, rodape: grupo.some((el) => el.matches("footer.rodape")), lugar: G.encaixar(1440, altura) };
    });
  });
  for (const g of r) {
    assert.ok(g.lugar.escala >= 0.74, `${g.id}: página encolhida demais (${g.lugar.escala.toFixed(2)})`);
    if (g.lugar.escala === 1) assert.equal(g.lugar.x, 0, `${g.id}: a seção devia ocupar a largura toda`);
  }
  assert.ok(r[r.length - 1].rodape, "o rodapé fica na página do contato");
  await page.close();
});

test("logos de 'Marcas que já colaboramos' levam às publis da marca", () => {
  const topo = html.split('class="marcas-topo"')[1].split("</section>")[0];
  const links = [...topo.matchAll(/<li><a href="publis\.html#(marca-[\w-]+)"><img [^>]*alt="([^"]+)"/g)];
  assert.equal(links.length, 11);
});

// Pedido (29/10): a data saiu do canto superior direito; no lugar de "Enviar proposta" e "Ver links" o PDF mostra
// "Media kit atualizado" e a data, no mesmo formato dos dois botões.
test("cópia do media kit: layout de desktop, sem cabeçalho, 'Media kit atualizado' e a data no lugar dos botões", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url + "index.html?pdf=1");
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const ctas = [...document.querySelectorAll(".hero__ctas > *")];
    return {
      modo: document.documentElement.classList.contains("modo-pdf"),
      topo: getComputedStyle(document.querySelector(".topo")).display,
      dock: getComputedStyle(document.querySelector(".dock")).display,
      ctas: ctas.map((c) => [c.textContent.trim(), c.className]), hoje: globalThis.GVST.hojeBR(),
      seloNoCanto: !!document.querySelector(".pdf-data"),
      heroAltura: document.querySelector(".hero").offsetHeight,
      sobreEmColunas: getComputedStyle(document.querySelector(".sobre")).gridTemplateColumns.split(" ").length > 1,
      letreiroCompleto: [...document.querySelectorAll(".letreiro__trilho > li:not([data-clone])")].every((li) => { const r = li.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })
    };
  });
  assert.ok(r.modo);
  assert.equal(r.topo, "none", "o PDF não leva o cabeçalho");
  assert.equal(r.dock, "none");
  assert.deepEqual(r.ctas, [["Media kit atualizado", "btn btn--ink"], [r.hoje, "btn btn--line"]]);
  assert.equal(r.seloNoCanto, false, "a data não fica mais no canto superior direito");
  assert.equal(r.heroAltura, Math.round((1440 * 210) / 297), "o topo tem a altura exata da página (sem faixa sobrando)");
  assert.ok(r.sobreEmColunas, "layout de desktop");
  assert.ok(r.letreiroCompleto, "todas as marcas aparecem inteiras no PDF");
  await page.close();
});

test("na página normal os botões do topo continuam e o cabeçalho também", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url);
  const r = await page.evaluate(() => ({ ctas: [...document.querySelectorAll(".hero__ctas > *")].map((c) => c.textContent.trim()), topo: getComputedStyle(document.querySelector(".topo")).display }));
  assert.deepEqual(r.ctas, ["Enviar proposta", "Ver links"]);
  assert.notEqual(r.topo, "none");
  await page.close();
});

// Bugs originais do PDF: fileira escura no pé de cada seção (linha horizontal), faixa clara sobrando embaixo das
// marcas, moldura clara em volta do bloco escuro do contato, seções picadas com sobra e a MUDAH sozinha numa página.
test("PDF sem emendas nem faixas soltas: bordas na cor da seção, topo inteiro, seção curta junto da seguinte", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url + "index.html?pdf=1");
  await page.evaluate(() => globalThis.GVST.gerarPdfAqui());
  const rel = await page.evaluate(() => globalThis.GVST.relatorioPdf);
  const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
  const perto = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 14);
  for (const p of rel) {
    // o pé de cada página tem a cor da última seção (nada de fileira escura em seção clara)
    // o topo termina na faixa escura "Marcas que já colaboramos"; as demais, no fundo da última seção da página
    const fundo = p.secoes[0] === "inicio" ? [21, 21, 21] : /rgba\(0, 0, 0, 0\)|transparent/.test(p.fundoFim) ? [228, 228, 224] : rgb(p.fundoFim);
    assert.ok(perto(p.baixo, fundo), `${p.secoes}: pé da página ${p.baixo} diferente do fundo ${fundo}`);
    assert.ok(p.escala >= 0.74, `${p.secoes}: encolheu demais (${p.escala.toFixed(2)})`);
  }
  assert.equal(rel[0].secoes[0], "inicio");
  assert.equal(rel[0].escala, 1);
  assert.ok(Math.abs(rel[0].y) < 1, "o topo ocupa a página inteira, sem faixa em cima ou embaixo");
  assert.ok(rel.some((p) => p.secoes.includes("agencia") && p.secoes.includes("contato")), "MUDAH divide a página com o contato");
  for (const id of ["sobre", "personagem", "trabalhos", "audiencia"]) {
    assert.equal(rel.filter((p) => p.secoes.includes(id)).length, 1, `${id} cabe numa página só`);
  }
  await page.close();
});

test("o site leva ao media kit (links, contato e página de publis)", async () => {
  const publis = await readFile(join(RAIZ, "publis.html"), "utf8");
  assert.match(html.split('id="links"')[1].split("</section>")[0], /class="kit-banner" data-imprimir/);
  assert.match(html, /class="contato__kit" data-imprimir/);
  assert.match(publis, /class="contato__kit" href="index\.html\?kit=1"/);
});

// Pedido (29/10): o PDF não tem página com o título "O homem performático" — ele não quer ficar preso a esse
// personagem (vai criar outros). Desde 01/11 (padrão novo, pedido do cliente) a página Personagens do PDF é a própria
// seção do site: um vídeo de cada personagem e o Performômetro, que no papel sai montado (100%), sem confete.
test("PDF: sem o título 'O homem performático'; Personagens numa página só, com o Performômetro montado", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(servidor.url + "index.html?pdf=1");
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const s = document.getElementById("personagem");
    const visivel = (sel) => [...document.querySelectorAll(sel)].some((e) => e.offsetHeight > 0);
    return {
      titulo: visivel(".personagem__titulo") || [...document.querySelectorAll("main h1, main h2, main h3")].some((h) => h.offsetHeight > 0 && /^O homem\s*performático$/i.test(h.textContent.trim())),
      nivel: document.getElementById("medidor").getAttribute("aria-valuenow"),
      marcados: document.querySelectorAll('#monte .item[aria-pressed="true"]').length,
      confete: getComputedStyle(document.getElementById("confete")).display,
      paginas: globalThis.GVST.paginasDoKit().filter((g) => g.includes(s)).length,
      escala: globalThis.GVST.encaixar(1440, s.offsetHeight).escala
    };
  });
  assert.equal(r.titulo, false);
  assert.deepEqual([r.nivel, r.marcados, r.confete], ["100", 6, "none"]);
  assert.equal(r.paginas, 1);
  assert.ok(r.escala >= 0.8, `encolheu demais: ${r.escala.toFixed(2)}`);
  await page.close();
});

// 01/11 (pedido do cliente): a seção Personagens da home ficou enxuta — sem o título grande "O homem performático",
// sem Performômetro, só um vídeo de cada personagem.
test("no site a seção Personagens é enxuta: um vídeo de cada personagem, sem título grande, com o Performômetro ao lado", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(servidor.url);
  const r = await page.evaluate(() => ({
    titulo: !!document.querySelector(".personagem__titulo"),
    jogo: !!document.querySelector("#monte"),
    videos: document.querySelectorAll("#personagem .video").length,
    fileira: new Set([...document.querySelectorAll("#personagem .video")].map((v) => Math.round(v.getBoundingClientRect().top))).size
  }));
  // o Performômetro voltou como 4ª coluna (pedido seguinte de 01/11, ver performometro-ao-lado-dos-personagens.test.js)
  assert.deepEqual(r, { titulo: false, jogo: true, videos: 3, fileira: 1 });
  await page.close();
});
