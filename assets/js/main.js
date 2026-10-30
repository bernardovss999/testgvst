/* Gustavo Correa — interações e contador ao vivo */
(function () {
  "use strict";

  var INTERVALO_MS = 15000;
  var FONTES = ["api/seguidores", "dados/metricas.json"];

  /* ---------- formatação ---------- */
  function compacto(n) {
    if (n >= 1e6) return (Math.round(n / 1e5) / 10).toLocaleString("pt-BR") + " mi";
    if (n >= 1e3) return Math.round(n / 1e3).toLocaleString("pt-BR") + " mil";
    return String(n);
  }

  function formatar(m) {
    if (!m || typeof m.valor !== "number") return "...";
    return m.aprox ? compacto(m.valor) : m.valor.toLocaleString("pt-BR");
  }

  function totalSeguidores(p) {
    var partes = [p.instagram.seguidores, p.tiktok.seguidores, p.youtube.inscritos];
    return {
      valor: partes.reduce(function (s, m) { return s + m.valor; }, 0),
      aprox: partes.some(function (m) { return m.aprox; })
    };
  }

  function lerMetrica(dados, caminho) {
    var p = dados.plataformas;
    // a soma é sempre mostrada por extenso, mesmo com o YouTube arredondado
    if (caminho === "total.seguidores") return { valor: totalSeguidores(p).valor, aprox: false };
    var partes = caminho.split(".");
    return p[partes[0]] && p[partes[0]][partes[1]];
  }

  globalThis.GVST = { formatar: formatar, compacto: compacto, totalSeguidores: totalSeguidores, lerMetrica: lerMetrica };
  if (typeof document === "undefined") return;

  document.documentElement.classList.add("js");
  // cópia usada para montar o media kit em PDF (mediakit.js): layout de desktop, sem cabeçalho e sem movimento
  var modoPdf = /[?&]pdf=1(&|$)/.test(location.search);
  if (modoPdf) document.documentElement.classList.add("modo-pdf");

  /* ---------- odômetro ---------- */
  var reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function montarOdometro(el, texto) {
    el.textContent = "";
    var caixa = document.createElement("span");
    caixa.className = "odo";
    caixa.setAttribute("aria-hidden", "true");
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (/\d/.test(c)) {
        var d = document.createElement("span");
        d.className = "odo__d";
        var col = document.createElement("span");
        col.className = "odo__col";
        for (var k = 0; k <= 9; k++) {
          var s = document.createElement("span");
          s.textContent = k;
          col.appendChild(s);
        }
        d.appendChild(col);
        caixa.appendChild(d);
      } else {
        var sep = document.createElement("span");
        sep.className = "odo__s";
        sep.textContent = c === " " ? " " : c;
        caixa.appendChild(sep);
      }
    }
    el.appendChild(caixa);
    return caixa;
  }

  function girar(caixa, texto) {
    var digitos = texto.replace(/\D/g, "");
    caixa.querySelectorAll(".odo__col").forEach(function (col, i) {
      col.style.transform = "translateY(-" + digitos[i] + "em)";
    });
  }

  function escrever(el, texto, animarEntrada) {
    var anterior = el.dataset.texto;
    var mudou = anterior !== undefined && anterior !== texto;
    el.setAttribute("aria-label", texto);
    if (!el.hasAttribute("data-odometro") || reduzMovimento) {
      el.textContent = texto;
    } else {
      var mesmaForma = anterior && anterior.replace(/\d/g, "0") === texto.replace(/\d/g, "0");
      var caixa = mesmaForma ? el.querySelector(".odo") : montarOdometro(el, texto);
      if (animarEntrada && !mesmaForma) {
        requestAnimationFrame(function () { requestAnimationFrame(function () { girar(caixa, texto); }); });
      } else {
        girar(caixa, texto);
      }
    }
    el.dataset.texto = texto;
    if (mudou) {
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }
  }

  /* ---------- leitura e atualização ---------- */
  var statusTexto = document.getElementById("status-texto");
  var primeiraVez = true;
  var ultimoDado = null;

  function hora(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function aplicar(dados, animar, aoVivo) {
    document.querySelectorAll("[data-metrica]").forEach(function (el) {
      escrever(el, formatar(lerMetrica(dados, el.getAttribute("data-metrica"))), animar);
    });
    if (statusTexto) {
      statusTexto.textContent = (aoVivo ? "Ao vivo · " : "Última leitura · ") + hora(dados.atualizadoEm);
    }
    ultimoDado = dados;
  }

  function dadosIniciais() {
    var el = document.getElementById("metricas-iniciais");
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  function buscarJson(url) {
    return fetch(url + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (dados) {
      if (!dados || !dados.plataformas) throw new Error("sem dados");
      return { dados: dados, aoVivo: url === FONTES[0] };
    });
  }

  function buscar() {
    if (!window.fetch || location.protocol === "file:") return Promise.reject(new Error("sem servidor"));
    return buscarJson(FONTES[0]).catch(function () { return buscarJson(FONTES[1]); });
  }

  function ciclo() {
    buscar().then(function (r) {
      var animar = primeiraVez;
      primeiraVez = false;
      aplicar(r.dados, animar, r.aoVivo);
    }).catch(function () {
      if (primeiraVez) {
        primeiraVez = false;
        var inicial = dadosIniciais();
        if (inicial) aplicar(inicial, true, false);
      }
    });
  }

  // a página de publis não tem números: não consulta o contador
  if (document.querySelector("[data-metrica]")) {
    ciclo();
    setInterval(function () { if (!document.hidden) ciclo(); }, INTERVALO_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) ciclo(); });
  }

  /* ---------- menu ---------- */
  var btn = document.getElementById("menu-btn");
  var topo = document.getElementById("topo");
  function fecharMenu() {
    topo.classList.remove("menu-aberto");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Abrir menu");
  }
  // o media kit não tem cabeçalho nem menu
  if (btn && topo) {
    btn.addEventListener("click", function () {
      var aberto = topo.classList.toggle("menu-aberto");
      btn.setAttribute("aria-expanded", String(aberto));
      btn.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    });
    document.querySelectorAll("#nav a").forEach(function (a) { a.addEventListener("click", fecharMenu); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharMenu(); });
  }

  /* ---------- player: troca a capa pelo vídeo na íntegra só no clique ---------- */
  function urlEmbed(player) {
    var tt = player.getAttribute("data-tiktok");
    if (tt) return "https://www.tiktok.com/player/v1/" + tt + "?autoplay=1&music_info=0&description=0&rel=0&native_context_menu=0";
    var ig = player.getAttribute("data-instagram");
    if (ig) return "https://www.instagram.com/" + ig + "/embed/";
    return null;
  }
  globalThis.GVST.urlEmbed = urlEmbed;

  document.querySelectorAll(".player").forEach(function (player) {
    var botao = player.querySelector("button.player__play");
    if (!botao) return;
    botao.addEventListener("click", function () {
      var src = urlEmbed(player);
      if (!src) return;
      var iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.title = botao.getAttribute("aria-label") || "Vídeo";
      iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      player.appendChild(iframe);
      player.classList.add("is-tocando");
      iframe.focus();
    });
  });

  /* ---------- sublinhado de "lifestyle": traço que faz uma volta por baixo do "y" ---------- */
  // Mede a linha de base e a posição real do "y" na fonte carregada e monta um traço contínuo:
  // colado na palavra, desce em curva por baixo da perna do "y" e volta para a linha até o fim da palavra.
  function caminhoRabisco(largura, base, fonte, xCauda) {
    var linha = base + fonte * 0.16;      // altura do sublinhado, logo abaixo das letras (o "f" itálico desce um pouco)
    var fundo = base + fonte * 0.46;      // ponto mais baixo da volta, abaixo da ponta do "y"
    var abre = fonte * 0.42;              // meia largura da volta
    var ini = Math.max(fonte * 0.02, 0);
    var fim = largura - fonte * 0.02;
    var a = xCauda - abre, b = xCauda + abre * 0.9;
    var onda = fonte * 0.035;             // altura das pequenas ondas do traço
    function n(v) { return v.toFixed(1); }
    // ondas suaves entre x0 e x1 (curvas encadeadas, sem quinas), terminando na altura da linha
    function ondas(x0, x1, sobe) {
      var qtd = Math.max(1, Math.round((x1 - x0) / (fonte * 0.5)));
      var passo = (x1 - x0) / qtd, d = [];
      for (var k = 0; k < qtd; k++) {
        var meio = x0 + passo * (k + 0.5), lado = (k % 2 === 0) === sobe ? -1 : 1;
        // variação leve de amplitude para não parecer régua
        var amp = onda * (0.75 + 0.5 * Math.abs(Math.sin(k * 1.7 + x0)));
        d.push("Q", n(meio), n(linha + lado * amp * 2), n(x0 + passo * (k + 1)), n(linha));
      }
      return d;
    }
    return ["M", n(ini), n(linha)]
      // entrada ondulando até perto do "y"
      .concat(ondas(ini, a, true))
      // desce contornando a perna do "y" por baixo e volta para a linha
      .concat(["C", n(a + abre * 0.45), n(linha), n(xCauda - abre * 0.55), n(fundo), n(xCauda), n(fundo)])
      .concat(["C", n(xCauda + abre * 0.55), n(fundo), n(b - abre * 0.45), n(linha), n(b), n(linha)])
      // segue ondulando até o fim da palavra
      .concat(ondas(b, fim, false))
      .join(" ");
  }
  globalThis.GVST.caminhoRabisco = caminhoRabisco;

  function desenharRabisco(em) {
    var svg = em.querySelector(".rabisco");
    var texto = em.firstChild;
    if (!svg || !texto || texto.nodeType !== 3) return;
    var i = texto.textContent.indexOf("y");
    if (i < 0) return;
    var caixa = em.getBoundingClientRect();
    if (!caixa.width) return;
    var fonte = parseFloat(getComputedStyle(em).fontSize);
    // linha de base: um marcador vazio alinhado à base do texto
    var marca = document.createElement("span");
    marca.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    em.insertBefore(marca, svg);
    var base = marca.getBoundingClientRect().top - caixa.top;
    em.removeChild(marca);
    var r = document.createRange();
    r.setStart(texto, i);
    r.setEnd(texto, i + 1);
    var letra = r.getBoundingClientRect();
    // no itálico a perna do "y" desce inclinada para a esquerda do centro da letra
    var xCauda = letra.left - caixa.left + letra.width * 0.32;
    var path = svg.querySelector("path");
    svg.setAttribute("viewBox", "0 0 " + caixa.width.toFixed(1) + " " + caixa.height.toFixed(1));
    svg.setAttribute("preserveAspectRatio", "none");
    path.setAttribute("d", caminhoRabisco(caixa.width, base, fonte, xCauda));
    svg.style.setProperty("--traco", Math.max(2.5, fonte * 0.065).toFixed(1) + "px");
    svg.style.setProperty("--comprimento", Math.ceil(path.getTotalLength() + 2));
    svg.dataset.cauda = xCauda.toFixed(1);
    svg.dataset.base = base.toFixed(1);
    svg.classList.add("is-medido");
  }
  var destaques = document.querySelectorAll(".destaque");
  var medirRabiscos = function () { destaques.forEach(desenharRabisco); };
  if (destaques.length) {
    medirRabiscos();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medirRabiscos);
    var esperaRabisco;
    window.addEventListener("resize", function () { clearTimeout(esperaRabisco); esperaRabisco = setTimeout(medirRabiscos, 120); });
  }

  /* ---------- loops contínuos: duplica o conteúdo dos trilhos ---------- */
  function duplicar(trilho) {
    Array.prototype.slice.call(trilho.children).forEach(function (filho) {
      var copia = filho.cloneNode(true);
      copia.setAttribute("data-clone", "");
      copia.setAttribute("aria-hidden", "true");
      copia.querySelectorAll("img").forEach(function (im) { im.alt = ""; });
      copia.querySelectorAll("a").forEach(function (a) { a.tabIndex = -1; });
      trilho.appendChild(copia);
    });
  }
  document.querySelectorAll(".ticker__trilho, .letreiro__trilho, .vitrine__col, .carrossel__trilho").forEach(duplicar);

  /* ---------- vitrine: vídeos do fundo só tocam com o topo visível ---------- */
  var conexao = navigator.connection || {};
  var videosFundo = document.querySelectorAll(".vitrine video");
  function carregar(video) {
    if (video.dataset.carregado) return;
    video.querySelectorAll("source[data-src]").forEach(function (s) { s.src = s.getAttribute("data-src"); });
    video.dataset.carregado = "1";
    video.load();
  }
  // todos os vídeos da vitrine tocam juntos enquanto o topo está na tela (pausam fora dela)
  function tocarTodos() {
    videosFundo.forEach(function (v) {
      carregar(v);
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });
  }
  var vitrine = document.querySelector(".vitrine");
  if (vitrine && !reduzMovimento && !conexao.saveData && !modoPdf) {
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entradas) {
        if (entradas[0].isIntersecting) tocarTodos();
        else videosFundo.forEach(function (v) { v.pause(); });
      }).observe(vitrine);
    } else {
      tocarTodos();
    }
  }

  /* ---------- retrato acompanha o mouse ---------- */
  var retrato = document.getElementById("retrato");
  var figura = document.querySelector(".hero__figura");
  if (retrato && figura && !reduzMovimento && window.matchMedia("(hover: hover)").matches) {
    figura.addEventListener("mousemove", function (e) {
      var r = figura.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      retrato.style.setProperty("--ry", (x * 10).toFixed(2) + "deg");
      retrato.style.setProperty("--rx", (-y * 8).toFixed(2) + "deg");
    });
    figura.addEventListener("mouseleave", function () {
      retrato.style.setProperty("--ry", "0deg");
      retrato.style.setProperty("--rx", "0deg");
    });
  }

  /* ---------- jogo: monte o seu homem performático ---------- */
  var FRASES = [
    [0, "Apenas um cara tranquilo"],
    [1, "Começando a performar"],
    [3, "Achei conceito"],
    [5, "Bem astéric"],
    [6, "100% homem performático 💆🏾‍♂️"]
  ];
  function frasePara(qtd) {
    var f = FRASES[0][1];
    FRASES.forEach(function (par) { if (qtd >= par[0]) f = par[1]; });
    return f;
  }
  globalThis.GVST.frasePara = frasePara;

  var monte = document.getElementById("monte");
  if (monte) {
    var itens = monte.querySelectorAll(".item");
    var medidor = document.getElementById("medidor");
    var nivel = document.getElementById("nivel");
    var nivelFrase = document.getElementById("nivel-frase");
    var carinha = document.getElementById("nivel-emoji");
    var confete = document.getElementById("confete");
    var CARINHAS = ["😐", "🙂", "🙂", "😎", "😎", "💅🏾", "💆🏾‍♂️"];
    var soltarConfete = function () {
      if (reduzMovimento || !confete) return;
      var bichos = ["🍃", "👓", "💆🏾‍♂️", "☕", "📚", "🤎", "✌🏾"];
      for (var i = 0; i < 18; i++) {
        var e = document.createElement("span");
        e.textContent = bichos[i % bichos.length];
        e.style.left = Math.round(Math.random() * 92) + "%";
        e.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
        e.style.setProperty("--g", Math.round(Math.random() * 120 - 60) + "deg");
        confete.appendChild(e);
      }
      setTimeout(function () { confete.textContent = ""; }, 2600);
    };
    var atualizarMedidor = function () {
      var qtd = monte.querySelectorAll('.item[aria-pressed="true"]').length;
      var pct = Math.round((qtd / itens.length) * 100);
      var frase = frasePara(qtd);
      medidor.style.setProperty("--nivel", pct + "%");
      var emoji = CARINHAS[qtd];
      if (carinha.textContent !== emoji) {
        carinha.textContent = emoji;
        carinha.classList.remove("is-mudou"); void carinha.offsetWidth; carinha.classList.add("is-mudou");
      }
      medidor.setAttribute("aria-valuenow", String(pct));
      medidor.setAttribute("aria-valuetext", pct + "%, " + frase.toLowerCase());
      nivel.textContent = pct + "%";
      nivelFrase.textContent = frase;
      var completo = qtd === itens.length;
      if (completo && !monte.classList.contains("is-completo")) soltarConfete();
      monte.classList.toggle("is-completo", completo);
    };
    itens.forEach(function (item) {
      item.addEventListener("click", function () {
        item.setAttribute("aria-pressed", String(item.getAttribute("aria-pressed") !== "true"));
        atualizarMedidor();
      });
    });
  }

  /* ---------- copiar cupom ---------- */
  document.querySelectorAll(".cupom__copiar").forEach(function (b) {
    b.addEventListener("click", function () {
      var codigo = b.getAttribute("data-cupom");
      var ok = function () {
        b.textContent = "Copiado! ✌🏾";
        b.classList.add("is-copiado");
        setTimeout(function () { b.textContent = "Copiar cupom"; b.classList.remove("is-copiado"); }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(codigo).then(ok, ok);
      else ok();
    });
  });

  /* ---------- vibe performática: barra e selo de "nível de performance" + barra fixa do mobile ---------- */
  var fill = document.getElementById("performance-fill");
  var selo = document.getElementById("performance-selo");
  var seloNum = document.getElementById("performance-num");
  var dock = document.getElementById("dock");
  var contato = document.getElementById("contato");
  var barraEscura = document.getElementById("barra-escura");
  var faixaMarcas = document.querySelector(".marcas-topo");
  function nivelPerformance() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0;
  }
  globalThis.GVST.nivelPerformance = nivelPerformance;
  var pendente = false;
  function atualizarPerformance() {
    pendente = false;
    var pct = nivelPerformance();
    if (fill) fill.style.setProperty("--p", (pct / 100).toFixed(3));
    if (seloNum) seloNum.textContent = pct + "%";
    var passouTopo = window.scrollY > window.innerHeight * 0.8;
    var noContato = contato && contato.getBoundingClientRect().top < window.innerHeight * 0.85;
    if (selo) {
      selo.classList.toggle("is-visivel", passouTopo);
      selo.classList.toggle("is-max", pct >= 99);
    }
    if (dock) dock.classList.toggle("is-visivel", passouTopo && !noContato);
    // Safari do iPhone pinta a barra de baixo com a cor de um elemento fixo na borda: escura enquanto a faixa das marcas está embaixo
    if (barraEscura && faixaMarcas) {
      var f = faixaMarcas.getBoundingClientRect();
      barraEscura.classList.toggle("is-ativa", f.bottom > window.innerHeight * 0.85 && f.top < window.innerHeight);
    }
  }
  window.addEventListener("scroll", function () {
    if (!pendente) { pendente = true; requestAnimationFrame(atualizarPerformance); }
  }, { passive: true });
  window.addEventListener("resize", atualizarPerformance);
  atualizarPerformance();

  /* ---------- celular no ritmo de um Reels: carrosséis andam sozinhos e reações sobem ---------- */
  var celular = window.matchMedia("(max-width: 640px)");
  var PASSO_MS = 2600;

  // avança um item por vez; para quando a pessoa toca no carrossel (volta depois) ou abre um vídeo (não volta)
  function autodeslize(trilho) {
    var pausadoAte = 0;
    var visivel = false;
    trilho.setAttribute("data-autodeslize", "");
    var marcarFoco = function () {
      var esq = trilho.getBoundingClientRect().left;
      var perto = null, menor = Infinity;
      Array.prototype.forEach.call(trilho.children, function (filho) {
        var d = Math.abs(filho.getBoundingClientRect().left - esq);
        if (d < menor) { menor = d; perto = filho; }
      });
      Array.prototype.forEach.call(trilho.children, function (filho) { filho.classList.toggle("is-foco", filho === perto); });
    };
    var pausar = function () { pausadoAte = Date.now() + 7000; };
    ["pointerdown", "touchstart", "wheel", "focusin"].forEach(function (ev) { trilho.addEventListener(ev, pausar, { passive: true }); });
    trilho.addEventListener("scroll", function () { requestAnimationFrame(marcarFoco); }, { passive: true });
    new IntersectionObserver(function (en) { visivel = en[0].isIntersecting; }, { threshold: 0.5 }).observe(trilho);
    marcarFoco();
    setInterval(function () {
      if (!visivel || document.hidden || Date.now() < pausadoAte || trilho.querySelector(".is-tocando")) return;
      var primeiro = trilho.children[0], segundo = trilho.children[1];
      if (!segundo) return;
      var fim = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 4;
      trilho.scrollTo({ left: fim ? 0 : trilho.scrollLeft + (segundo.offsetLeft - primeiro.offsetLeft), behavior: "smooth" });
    }, PASSO_MS);
  }

  var REACOES = ["🔥", "😂", "💅🏾", "👏🏾", "🤎", "😎", "✌🏾", "💆🏾‍♂️"];
  function soltarReacoes() {
    var caixa = document.createElement("div");
    caixa.className = "reacoes";
    caixa.setAttribute("aria-hidden", "true");
    document.body.appendChild(caixa);
    setInterval(function () {
      if (document.hidden || !dock || !dock.classList.contains("is-visivel")) return;
      var r = document.createElement("span");
      r.textContent = REACOES[Math.floor(Math.random() * REACOES.length)];
      r.style.setProperty("--x1", Math.round(Math.random() * 16 - 8) + "px");
      r.style.setProperty("--x2", Math.round(Math.random() * 40 - 28) + "px");
      r.style.setProperty("--g", Math.round(Math.random() * 40 - 20) + "deg");
      caixa.appendChild(r);
      setTimeout(function () { r.remove(); }, 2700);
    }, 1100);
  }
  globalThis.GVST.autodeslize = autodeslize;

  if (celular.matches && !reduzMovimento && !modoPdf && "IntersectionObserver" in window) {
    document.querySelectorAll(".grade-videos, .galeria, .marca__videos").forEach(autodeslize);
    soltarReacoes();
  }

  /* ---------- revelação suave ---------- */
  // itens de grade entram em cascata
  document.querySelectorAll(".redes-grandes, .cupons, .mais-links, .grade-videos, .marca__videos, .galeria, .alem__lista").forEach(function (grade) {
    Array.prototype.forEach.call(grade.children, function (filho, i) { filho.style.setProperty("--atraso", (i % 6) * 0.07 + "s"); });
  });
  var alvos = document.querySelectorAll(".cabeca, .redes-grandes > li, .cupom, .mais-links > li, .personagem, .grade-videos > li, .alem__lista > li, .tabela-plat, .soma, .publi-marca, .audiencia, .sobre, .galeria > figure, .mais-vistos .subtitulo, .agencia, .contato__topo");
  if ("IntersectionObserver" in window && !reduzMovimento) {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visivel"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -5% 0px" });
    alvos.forEach(function (el) { el.classList.add("revela"); io.observe(el); });
    // rede de segurança: em rolagem muito rápida o observer pode pular itens; revela tudo que já passou pela tela
    var agendado = false;
    var revelarPassados = function () {
      agendado = false;
      var limite = window.innerHeight * 0.95;
      document.querySelectorAll(".revela:not(.is-visivel)").forEach(function (el) {
        if (el.getBoundingClientRect().top < limite) { el.classList.add("is-visivel"); io.unobserve(el); }
      });
    };
    window.addEventListener("scroll", function () {
      if (!agendado) { agendado = true; requestAnimationFrame(revelarPassados); }
    }, { passive: true });
  }

})();
