/* Media kit em PDF: o site no layout de computador, sem o cabeçalho, com a data de atualização no canto.
   Funciona igual no iPhone, no Android e no computador porque o PDF é montado aqui, não pela impressora:
   1) a home abre uma cópia invisível de si mesma com 1440 x 900 (index.html?pdf=1, layout de desktop);
   2) a cópia fotografa cada seção (html-to-image) e monta páginas A4 deitadas (jsPDF), cada seção na largura toda, com links;
   3) a home entrega o arquivo (baixar, ou compartilhar/salvar no celular). */
(function () {
  "use strict";

  var G = globalThis.GVST || (globalThis.GVST = {});
  var LARGURA = 1440, ALTURA_TELA = 900;
  var PAGINA = { w: 1440, h: Math.round(1440 * 210 / 297) }; // A4 deitado
  var FUNDO = "#E4E4E0";
  var RESOLUCAO = 1.5;
  var LIBS = ["assets/js/vendor/html-to-image.js", "assets/js/vendor/jspdf.umd.min.js"];
  var modoPdf = document.documentElement.classList.contains("modo-pdf");

  function hojeBR() {
    return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  G.hojeBR = hojeBR;

  function carregarScript(src) {
    return new Promise(function (ok, erro) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = function () { erro(new Error("não carregou " + src)); };
      document.head.appendChild(s);
    });
  }
  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  /* ---------- dentro da cópia invisível (index.html?pdf=1) ---------- */

  // mostra tudo que entraria com a rolagem, carrega as imagens "lazy" e espera fontes e números
  // ícones usam <use href="#..."> de um sprite fora das seções; na foto de cada seção eles sumiriam
  function embutirIcones() {
    document.querySelectorAll("svg use").forEach(function (u) {
      var id = (u.getAttribute("href") || u.getAttribute("xlink:href") || "").slice(1);
      var simbolo = id && document.getElementById(id);
      var svg = u.ownerSVGElement;
      if (!simbolo || !svg) return;
      if (!svg.getAttribute("viewBox") && simbolo.getAttribute("viewBox")) svg.setAttribute("viewBox", simbolo.getAttribute("viewBox"));
      Array.prototype.forEach.call(simbolo.childNodes, function (n) { svg.insertBefore(n.cloneNode(true), u); });
      u.remove();
    });
  }

  function prepararPagina() {
    embutirIcones();
    document.querySelectorAll(".revela").forEach(function (el) { el.classList.add("is-visivel"); });
    var pendentes = [];
    document.querySelectorAll("img").forEach(function (im) {
      if (im.loading === "lazy") im.loading = "eager";
      if (!im.complete) pendentes.push(new Promise(function (ok) { im.addEventListener("load", ok, { once: true }); im.addEventListener("error", ok, { once: true }); }));
    });
    return Promise.race([Promise.all(pendentes), esperar(8000)])
      .then(function () { return document.fonts ? document.fonts.ready : null; })
      .then(function () { return esperar(600); });
  }

  // A folha de fontes do Google é de outro domínio e o navegador não deixa a biblioteca lê-la: baixamos o CSS e
  // embutimos só os arquivos dos subconjuntos latinos (os que o português usa), como data URL.
  // download com prazo: se a rede engasgar, a geração segue (sem a fonte) em vez de ficar parada para sempre
  var PRAZO_REDE = 10000;
  function buscar(url) {
    return Promise.race([
      fetch(url),
      new Promise(function (_, erro) { setTimeout(function () { erro(new Error("prazo esgotado: " + url)); }, PRAZO_REDE); })
    ]).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status + " " + url); return r; });
  }
  G.PRAZO_REDE = PRAZO_REDE;

  function arquivoComoDataUrl(url) {
    return buscar(url).then(function (r) { return r.blob(); }).then(function (blob) {
      return new Promise(function (ok) { var f = new FileReader(); f.onload = function () { ok(f.result); }; f.readAsDataURL(blob); });
    });
  }
  // Archivo e Instrument Serif (subconjuntos latinos) + Noto Color Emoji (só os emojis que aparecem na página):
  // o PDF sai com as mesmas letras e o mesmo desenho de emoji em qualquer servidor ou aparelho
  var EMOJI_CSS = "https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap";

  function codigosDeEmoji() {
    var codigos = {};
    Array.from(document.body.innerText || "").forEach(function (ch) {
      var c = ch.codePointAt(0);
      if (c >= 0x2190 && !(c >= 0xFE00 && c <= 0xFE0F)) codigos[c] = true;
    });
    return Object.keys(codigos).map(Number);
  }

  // um bloco por @font-face; o comentário que vem antes (/* latin */, /* [3] */...) fica junto, quando existe
  // (a CSS da Noto Color Emoji vem sem comentário: separar só pelo comentário deixava o PDF sem emoji, 01/11)
  function blocosDeFonte(css) {
    return css.match(/(?:\/\*[^*]*\*\/\s*)?@font-face\s*\{[^}]*\}/g) || [];
  }
  G.blocosDeFonte = blocosDeFonte;

  function cobre(bloco, codigos) {
    var m = bloco.match(/unicode-range:\s*([^;]+);/);
    if (!m) return false;
    return m[1].split(",").some(function (faixa) {
      var r = faixa.trim().replace(/^U\+/i, "").split("-");
      var ini = parseInt(r[0], 16), fim = r[1] ? parseInt(r[1], 16) : ini;
      return codigos.some(function (c) { return c >= ini && c <= fim; });
    });
  }

  function embutir(blocos) {
    return Promise.all(blocos.map(function (b) {
      var m = b.match(/url\(([^)]+)\)/);
      return m ? arquivoComoDataUrl(m[1].replace(/["']/g, "")).then(function (dado) { return b.replace(m[1], dado); }) : b;
    })).then(function (lista) { return lista.join("\n"); });
  }

  // as mesmas fontes do site, sempre (pedido do cliente): Archivo em tudo e Instrument Serif no destaque do topo
  var FONTES_DO_SITE = ["Archivo", "Instrument Serif"];
  G.FONTES_DO_SITE = FONTES_DO_SITE;
  function conferirFontesCarregadas() {
    if (!document.fonts) return;
    var carregadas = Array.from(document.fonts).filter(function (f) { return f.status === "loaded"; })
      .map(function (f) { return f.family.replace(/["']/g, ""); });
    var faltam = FONTES_DO_SITE.filter(function (f) { return carregadas.indexOf(f) < 0; });
    if (faltam.length) throw new Error("fontes do site não carregaram: " + faltam.join(", "));
  }
  G.conferirFontesCarregadas = conferirFontesCarregadas;

  function fontesEmbutidas() {
    var link = document.querySelector('link[href*="fonts.googleapis.com/css"]');
    var texto = link
      ? buscar(link.href).then(function (r) { return r.text(); }).then(function (css) {
        return embutir(blocosDeFonte(css).filter(function (b) { return /\/\* latin(-ext)? \*\//.test(b); }));
      })
      : Promise.resolve("");
    var codigos = codigosDeEmoji();
    var emoji = codigos.length
      ? buscar(EMOJI_CSS).then(function (r) { return r.text(); }).then(function (css) {
        return embutir(blocosDeFonte(css).filter(function (b) { return cobre(b, codigos); }));
      })
      : Promise.resolve("");
    var nada = function () { return ""; };
    // as fontes do site são obrigatórias: sem elas o PDF sairia com letra genérica, então é erro (o servidor tenta de novo)
    texto = texto.then(function (css) {
      var faltam = FONTES_DO_SITE.filter(function (f) { return css.indexOf("font-family: '" + f + "'") < 0; });
      if (!/url\(data:/.test(css)) faltam = FONTES_DO_SITE;
      if (faltam.length) throw new Error("fontes do site não embutidas: " + faltam.join(", "));
      return css;
    });
    return Promise.all([texto, emoji.catch(nada)]).then(function (partes) { return partes.join("\n"); });
  }
  G.fontesEmbutidas = fontesEmbutidas;

  function corDeFundo(el) {
    var c = getComputedStyle(el).backgroundColor;
    return !c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c) ? FUNDO : c;
  }

  // uma página por seção do site; o rodapé vai junto com a última (contato)
  // MODELO FIXO DO MEDIA KIT (aprovado pelo cliente em 29/10/2026). Toda geração, em qualquer celular, tablet ou
  // computador, segue exatamente este plano: 9 páginas A4 deitadas, nesta ordem, cada seção inteira na sua página.
  // Só os dados mudam na hora (seguidores e métricas ao vivo, data "Media kit atualizado"); se uma seção crescer, ela
  // encolhe para caber na mesma página, sem reorganizar o documento. Mudar o modelo é decisão do cliente: alterar
  // aqui, subir a versão e regravar tests/modelo/media-kit-modelo.json (o teste de regressão compara com ele).
  // 01/11/2026 (pedidos do cliente): versão 2026-11-01 trouxe "Filmes e curtas" depois dos personagens; a 2026-11-01.2
  // trouxe a página só de personagens; a 2026-11-01.3 tirou do PDF a seção da home; a 2026-11-01.4 (padrão novo) volta
  // a usar a seção Personagens do site (um vídeo de cada personagem + Performômetro) no lugar da página separada (9 páginas).
  var MODELO = {
    versao: "2026-11-01.4",
    paginas: [["inicio"], ["links"], ["sobre"], ["personagem"], ["filmes"], ["numeros"], ["trabalhos"], ["audiencia"], ["agencia", "contato", "rodape"]]
  };
  G.MODELO = MODELO;

  function elementoDoModelo(id) {
    var el = id === "rodape" ? document.querySelector("body > footer.rodape") : document.getElementById(id);
    return el && el.offsetHeight > 0 ? el : null;
  }

  function paginasDoKit() {
    var usados = {};
    var grupos = MODELO.paginas.map(function (ids) {
      return ids.map(function (id) { usados[id] = true; return elementoDoModelo(id); }).filter(Boolean);
    }).filter(function (g) { return g.length; });
    // seção nova no site que ainda não está no modelo: entra no fim, numa página própria (o teste do modelo avisa)
    Array.prototype.forEach.call(document.querySelectorAll("main > section"), function (el) {
      if (el.id && !usados[el.id] && el.offsetHeight > 0) grupos.push([el]);
    });
    return grupos;
  }
  G.paginasDoKit = paginasDoKit;

  // posição de cada pedaço na página: largura toda (encolhe só se for mais alto que a página), centralizado
  function encaixar(largura, altura) {
    var escala = Math.min(PAGINA.w / largura, PAGINA.h / altura, 1);
    var w = largura * escala, h = altura * escala;
    return { escala: escala, x: (PAGINA.w - w) / 2, y: (PAGINA.h - h) / 2, w: w, h: h };
  }
  G.encaixar = encaixar;

  /* ---------- links clicáveis no PDF ---------- */
  var BASE_SITE = location.href.split(/[?#]/)[0].replace(/[^/]*$/, "");
  function absoluto(href) {
    if (!href) return null;
    if (/^(https?:|mailto:|tel:)/.test(href)) return href;
    if (href.charAt(0) === "#") {
      // "Enviar proposta" no PDF já abre o e-mail comercial
      if (href === "#contato") { var email = document.querySelector(".contato__email"); return email ? email.href : BASE_SITE + "index.html#contato"; }
      return BASE_SITE + "index.html" + href;
    }
    return new URL(href, BASE_SITE).href;
  }
  function destinoDe(el) {
    if (el.matches("a[href]")) return absoluto(el.getAttribute("href"));
    // capa de vídeo: abre o vídeo na rede
    if (el.matches(".player")) { var v = el.closest(".video"); var l = v && v.querySelector(".video__link"); return l ? l.href : null; }
    // copiar cupom: leva para a loja (ou para os cupons no site)
    if (el.matches(".cupom__copiar")) { var loja = el.parentNode.querySelector("a[href]"); return loja ? loja.href : BASE_SITE + "index.html#links"; }
    return null;
  }
  function linksDoGrupo(grupo) {
    var topo = grupo[0].getBoundingClientRect().top, lista = [];
    grupo.forEach(function (el) {
      el.querySelectorAll("a[href], .player, .cupom__copiar").forEach(function (alvo) {
        if (alvo.closest("[data-clone], [data-imprimir], [hidden]")) return;
        var r = alvo.getBoundingClientRect();
        var url = destinoDe(alvo);
        if (!url || r.width < 2 || r.height < 2 || getComputedStyle(alvo).visibility === "hidden") return;
        lista.push({ x: r.left, y: r.top - topo, w: r.width, h: r.height, url: url });
      });
    });
    return lista;
  }
  G.linksDoGrupo = linksDoGrupo;

  // fotografa o grupo (seção, ou contato + rodapé) numa tela só, para depois recortar nas páginas
  function fotografarGrupo(grupo, fontes) {
    return grupo.reduce(function (p, el) {
      return p.then(function (telas) {
        return htmlToImage.toCanvas(el, { pixelRatio: RESOLUCAO, backgroundColor: corDeFundo(el), fontEmbedCSS: fontes || " ", width: el.offsetWidth, height: el.offsetHeight })
          .then(function (c) { return telas.concat([c]); });
      });
    }, Promise.resolve([])).then(function (telas) {
      if (telas.length === 1) return telas[0];
      var junta = document.createElement("canvas");
      junta.width = Math.max.apply(null, telas.map(function (c) { return c.width; }));
      // a fileira de transição do pé de cada seção sai também onde duas seções se encontram na mesma página
      var util = function (c, k) { return k < telas.length - 1 ? c.height - EMENDA : c.height; };
      junta.height = telas.reduce(function (s, c, k) { return s + util(c, k); }, 0);
      var ctx = junta.getContext("2d"), y = 0;
      telas.forEach(function (c, k) { var h = util(c, k); ctx.drawImage(c, 0, 0, c.width, h, 0, y, c.width, h); y += h; c.width = c.height = 0; });
      return junta;
    });
  }

  // cor média de uma fileira de pixels (para a sobra da página emendar sem faixa de outra cor)
  function corDaFileira(ctx, largura, y) {
    var d = ctx.getImageData(0, y, largura, 1).data, r = 0, g = 0, b = 0, n = d.length / 4;
    for (var k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  }

  // bordas esquerda e direita (2px) como imagens: quando o pedaço encolhe, elas são esticadas até a beira da
  // página e cada trecho (claro ou escuro) continua com a mesma cor, sem moldura nem emenda
  function bordaDoPedaco(origem, x) {
    var c = document.createElement("canvas");
    c.width = 2;
    c.height = origem.height;
    c.getContext("2d").drawImage(origem, x, 0, 2, origem.height, 0, 0, 2, origem.height);
    var dado = c.toDataURL("image/jpeg", 0.92);
    c.width = c.height = 0;
    return dado;
  }

  // a fileira do pé de cada foto (transição suavizada na borda) fica de fora: evita fio na junção entre seções
  var EMENDA = 2;
  function recortar(tela, ini, fim) {
    var c = document.createElement("canvas");
    var y0 = Math.round(ini * RESOLUCAO);
    c.width = tela.width;
    c.height = Math.max(1, Math.min(Math.round((fim - ini) * RESOLUCAO), tela.height - EMENDA - y0));
    var ctx = c.getContext("2d");
    ctx.drawImage(tela, 0, y0, tela.width, c.height, 0, 0, c.width, c.height);
    var pedaco = { img: c.toDataURL("image/jpeg", 0.86), h: c.height / RESOLUCAO, cima: corDaFileira(ctx, c.width, 0), baixo: corDaFileira(ctx, c.width, c.height - 1), esq: bordaDoPedaco(c, 1), dir: bordaDoPedaco(c, c.width - 3) };
    c.width = c.height = 0; // libera a memória (importante no celular)
    return pedaco;
  }

  // monta o PDF: A4 deitado, cada seção começa numa página nova, na largura toda, com o fundo da seção e os links
  function gerarPdfAqui(aviso) {
    return prepararPagina()
      .then(conferirFontesCarregadas)
      .then(function () { return Promise.all(LIBS.map(carregarScript)); })
      .then(fontesEmbutidas)
      .then(function (fontes) {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [PAGINA.w, PAGINA.h], compress: true });
        var grupos = paginasDoKit();
        var paginas = 0;
        G.relatorioPdf = []; // uma linha por página (usado nos testes de regressão do PDF)
        var passo = function (i) {
          if (i >= grupos.length) return doc.output("blob");
          if (aviso) aviso(i + 1, grupos.length);
          var grupo = grupos[i];
          var cortes = [{ ini: 0, fim: grupo.reduce(function (t, el) { return t + el.offsetHeight; }, 0) }]; // modelo: a seção inteira numa página
          var links = linksDoGrupo(grupo);
          var fundo = corDeFundo(grupo[0]);
          return fotografarGrupo(grupo, fontes).then(function (tela) {
            cortes.forEach(function (corte, k) {
              if (paginas > 0) doc.addPage([PAGINA.w, PAGINA.h], "landscape");
              paginas++;
              var pedaco = recortar(tela, corte.ini, corte.fim);
              var lugar = encaixar(LARGURA, pedaco.h);
              G.relatorioPdf.push({ modelo: MODELO.versao, secoes: grupo.map(function (el) { return el.id || el.className; }), escala: lugar.escala, x: lugar.x, y: lugar.y, h: pedaco.h, cima: pedaco.cima, baixo: pedaco.baixo, fundoFim: getComputedStyle(grupo[grupo.length - 1]).backgroundColor });
              // a sobra em cima e embaixo leva a cor da borda do pedaço: a página fica inteira, sem faixa solta
              doc.setFillColor(fundo);
              doc.rect(0, 0, PAGINA.w, PAGINA.h, "F");
              doc.setFillColor(pedaco.cima[0], pedaco.cima[1], pedaco.cima[2]);
              doc.rect(0, 0, PAGINA.w, lugar.y + 1, "F");
              doc.setFillColor(pedaco.baixo[0], pedaco.baixo[1], pedaco.baixo[2]);
              doc.rect(0, lugar.y + lugar.h - 1, PAGINA.w, PAGINA.h - lugar.y - lugar.h + 1, "F");
              if (lugar.x > 0.5) {
                doc.addImage(pedaco.esq, "JPEG", 0, lugar.y, lugar.x + 1, lugar.h, "e" + i + "-" + k);
                doc.addImage(pedaco.dir, "JPEG", lugar.x + lugar.w - 1, lugar.y, PAGINA.w - lugar.x - lugar.w + 1, lugar.h, "d" + i + "-" + k);
              }
              doc.addImage(pedaco.img, "JPEG", lugar.x, lugar.y, lugar.w, lugar.h, "p" + i + "-" + k);
              links.forEach(function (l) {
                var y0 = Math.max(l.y, corte.ini), y1 = Math.min(l.y + l.h, corte.fim);
                if (y1 - y0 < 4) return;
                doc.link(lugar.x + l.x * lugar.escala, lugar.y + (y0 - corte.ini) * lugar.escala, l.w * lugar.escala, (y1 - y0) * lugar.escala, { url: l.url });
              });
            });
            tela.width = tela.height = 0;
            return passo(i + 1);
          });
        };
        return passo(0);
      });
  }
  G.gerarPdfAqui = gerarPdfAqui;

  if (modoPdf) {
    // emoji com o mesmo desenho em qualquer servidor ou aparelho (o Chromium da Vercel não traz fonte de emoji)
    var fonteEmoji = document.createElement("link");
    fonteEmoji.rel = "stylesheet";
    fonteEmoji.href = EMOJI_CSS;
    document.head.appendChild(fonteEmoji);
    // Performômetro no papel: montado (todos os itens marcados, 100% homem performático), já que não dá para clicar
    Array.prototype.forEach.call(document.querySelectorAll("#monte .item[aria-pressed='false']"), function (b) { b.click(); });
    // no lugar de "Enviar proposta" e "Ver links": "Media kit atualizado" e a data, no mesmo formato dos botões
    var ctas = document.querySelector(".hero__ctas");
    if (ctas) {
      ctas.classList.add("pdf-atualizado");
      ctas.innerHTML = '<span class="btn btn--ink">Media kit atualizado</span><span class="btn btn--line">' + hojeBR() + "</span>";
    }
    return;
  }

  /* ---------- na página que a pessoa está vendo ---------- */

  var ocupado = false;
  function mostrarAviso() {
    var caixa = document.createElement("div");
    caixa.className = "pdf-aviso";
    caixa.setAttribute("role", "status");
    caixa.setAttribute("aria-live", "polite");
    caixa.innerHTML = '<span class="pdf-aviso__giro" aria-hidden="true"></span><span class="pdf-aviso__texto">Montando o media kit…</span>';
    document.body.appendChild(caixa);
    var texto = caixa.querySelector(".pdf-aviso__texto");
    return {
      texto: function (t) { texto.textContent = t; },
      fechar: function (depois) { setTimeout(function () { caixa.remove(); }, depois || 0); }
    };
  }

  // nome padrão do arquivo (pedido de 01/11), igual ao do servidor (api/media-kit-core.mjs)
  function nomeArquivo() {
    return "Gustavo Correa Media kit.pdf";
  }
  G.nomeArquivo = nomeArquivo;

  function baixar(blob, nome) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  // no celular abre o menu de compartilhar (Salvar em Arquivos, WhatsApp...); se não der, baixa
  function entregar(blob) {
    var nome = nomeArquivo();
    G.ultimoPdf = { nome: nome, tamanho: blob.size };
    var arquivo = typeof File === "function" ? new File([blob], nome, { type: "application/pdf" }) : null;
    var toque = window.matchMedia("(pointer: coarse)").matches;
    if (toque && arquivo && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      return navigator.share({ files: [arquivo], title: "Media kit · Gustavo Correa" }).catch(function (e) {
        if (!e || e.name !== "AbortError") baixar(blob, nome);
      });
    }
    baixar(blob, nome);
    return Promise.resolve();
  }

  // reserva: monta no próprio navegador (só no Chrome/Edge/Android, mesmo motor do servidor = mesmo modelo)
  function gerarAqui(aviso) {
    var quadro = document.createElement("iframe");
    quadro.title = "Media kit";
    quadro.setAttribute("aria-hidden", "true");
    quadro.tabIndex = -1;
    quadro.style.cssText = "position:fixed;left:-30000px;top:0;width:" + LARGURA + "px;height:" + ALTURA_TELA + "px;border:0;";
    quadro.src = "index.html?pdf=1";
    var pronto = new Promise(function (ok) { quadro.addEventListener("load", ok, { once: true }); });
    document.body.appendChild(quadro);
    return pronto
      .then(function () { return quadro.contentWindow.GVST.gerarPdfAqui(function (i, n) { aviso.texto("Montando o media kit… " + i + " de " + n); }); })
      .then(function (blob) { quadro.remove(); return blob; }, function (e) { quadro.remove(); throw e; });
  }

  // o modelo fixo só sai idêntico no Chromium; Safari e Firefox desenham a captura diferente (fotos em branco)
  function navegadorChromium() {
    var marcas = navigator.userAgentData && navigator.userAgentData.brands;
    return !!(marcas && marcas.some(function (m) { return /Chromium/.test(m.brand); }));
  }
  G.navegadorChromium = navegadorChromium;

  // o PDF vem pronto do servidor (api/media-kit), sempre no mesmo motor: igual em iPhone, Android e computador
  // a primeira geração depois de um tempo parado acorda o servidor (≈50 s, perto do limite de 60 s da Vercel) e
  // pode falhar; a seguinte já sai rápida. Então tentamos de novo sozinhos antes de mostrar qualquer erro.
  var TENTATIVAS = 3;
  G.TENTATIVAS = TENTATIVAS;
  function pedirComTentativas(aviso, n) {
    n = n || 1;
    return pedirAoServidor().catch(function (e) {
      if (n >= TENTATIVAS) throw e;
      console.warn("media kit: tentativa " + n + " falhou, tentando de novo", e);
      aviso.texto("Quase lá, finalizando o media kit…");
      return pedirComTentativas(aviso, n + 1);
    });
  }

  function pedirAoServidor() {
    var controle = "AbortController" in window ? new AbortController() : null;
    var prazo = setTimeout(function () { if (controle) controle.abort(); }, 90000);
    return fetch("api/media-kit?t=" + Date.now(), { cache: "no-store", signal: controle && controle.signal })
      .then(function (r) {
        clearTimeout(prazo);
        if (!r.ok || !/pdf/.test(r.headers.get("content-type") || "")) throw new Error("servidor " + r.status);
        return r.blob();
      }, function (e) { clearTimeout(prazo); throw e; });
  }

  function gerarMediaKit() {
    if (ocupado) return Promise.resolve();
    ocupado = true;
    var aviso = mostrarAviso();
    aviso.texto("Montando o media kit…");
    return pedirComTentativas(aviso)
      .catch(function (e) {
        if (!navegadorChromium()) throw e;
        console.warn("media kit: servidor indisponível, montando aqui", e);
        return gerarAqui(aviso);
      })
      .then(function (blob) {
        aviso.texto("Media kit pronto ✌🏾");
        return entregar(blob);
      })
      .catch(function (e) {
        console.warn("media kit:", e);
        aviso.texto("Não deu para gerar o media kit agora. Tente de novo em instantes.");
      })
      .then(function () {
        aviso.fechar(2600);
        ocupado = false;
      });
  }
  G.gerarMediaKit = gerarMediaKit;

  document.querySelectorAll("[data-imprimir]").forEach(function (b) { b.addEventListener("click", gerarMediaKit); });
  // a página de publis manda para index.html?kit=1
  if (/[?&]kit=1(&|$)/.test(location.search)) window.addEventListener("load", function () { setTimeout(gerarMediaKit, 300); });

  // Ctrl+P / Imprimir do navegador: sai o site limpo, sem cabeçalho e com a data
  window.addEventListener("beforeprint", function () {
    document.documentElement.classList.add("modo-pdf");
    document.querySelectorAll(".revela").forEach(function (el) { el.classList.add("is-visivel"); });
  });
  window.addEventListener("afterprint", function () { document.documentElement.classList.remove("modo-pdf"); });
})();
