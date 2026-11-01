// Pedido de 01/11: #personagem vira área de personagens (homem performático + outros, gerados de dados/personagens.json),
// nova seção #filmes ("Filmes e curtas", de dados/filmes.json), página personagens.html, e as duas no media kit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { RAIZ } from "../servidor.js";

const ler = (a) => readFile(join(RAIZ, a), "utf8");
const semComentarios = (h) => h.replace(/<!--[\s\S]*?-->/g, "");
const existe = (p) => access(join(RAIZ, p)).then(() => true, () => false);

test("HTML em dia com dados/personagens.json e dados/filmes.json (gerador --verificar)", () => {
  execFileSync("python", [join(RAIZ, "scripts/gerar-personagens.py"), "--verificar"], { stdio: "pipe" });
});

test("#filmes fica entre #personagem e #numeros, com fundo cinza (alternância noite / cinza / padrão)", async () => {
  const h = await ler("index.html");
  const ordem = ["personagem", "filmes", "numeros"].map((id) => h.indexOf(`id="${id}"`));
  assert.ok(ordem[0] > 0 && ordem[0] < ordem[1] && ordem[1] < ordem[2], "ordem das seções");
  assert.match(h, /<section class="secao secao--cinza" id="filmes" aria-labelledby="filmes-titulo">/);
  assert.match(h, /<h2 class="titulo" id="filmes-titulo">Filmes e curtas<\/h2>/);
  // 2º pedido de 01/11: o título geral virou "Personagens" (h2) e o rótulo, "O diferencial"
  assert.match(h, /<h2 class="titulo" id="personagem-titulo">Personagens<\/h2>/);
});

test("filmes publicados do mais recente ao mais antigo; Obsessão e Odisseia só comentados até chegar o link", async () => {
  const dados = JSON.parse(await ler("dados/filmes.json"));
  const h = semComentarios(await ler("index.html"));
  const bloco = h.split('id="filmes"')[1].split("</section>")[0];
  const vistos = [...bloco.matchAll(/data-instagram="reel\/([\w-]+)"/g)].map((m) => m[1]);
  const esperado = dados.filmes.filter((f) => f.status === "publicado").sort((a, b) => b.data.localeCompare(a.data)).map((f) => f.codigo);
  assert.deepEqual(vistos, esperado);
  assert.doesNotMatch(bloco, /Obsessão|Odisseia/);
  for (const c of dados.candidatos) assert.ok(!bloco.includes(c.split(" ")[0]), "candidato publicado sem confirmação");
});

test("reels 'confirmar com Zach' não aparecem no site (só em comentário)", async () => {
  const dados = JSON.parse(await ler("dados/personagens.json"));
  const pendentes = dados.personagens.flatMap((p) => p.videos).filter((v) => v.status !== "publicado").map((v) => v.codigo);
  assert.ok(pendentes.length > 0);
  for (const arq of ["index.html", "personagens.html"]) {
    const h = semComentarios(await ler(arq));
    for (const c of pendentes) assert.ok(!h.includes(c), `${c} visível em ${arq}`);
  }
});

test("todo card novo tem capa local que existe, com width/height, lazy e alt", async () => {
  for (const arq of ["index.html", "personagens.html"]) {
    const h = semComentarios(await ler(arq));
    const imgs = [...h.matchAll(/<div class="player"[^>]*>\s*<img ([^>]+)>/g)].map((m) => m[1]);
    // 01/11: a home ficou com 1 vídeo por personagem (3) + os 4 filmes; personagens.html tem todos
    assert.ok(imgs.length >= (arq === "index.html" ? 7 : 40), `${arq}: só ${imgs.length} capas`);
    for (const a of imgs) {
      const src = a.match(/src="([^"]+)"/)[1];
      assert.ok(await existe(src), `${arq}: ${src} não existe`);
      assert.match(a, /width="\d+" height="\d+" loading="lazy" alt="[^"]+"/, src);
    }
  }
});

// 01/11 (3º pedido): a home ficou só com um vídeo de cada personagem; todos os vídeos ficam em personagens.html
test("home: um vídeo de cada personagem; personagens.html: todos os vídeos publicados de cada um", async () => {
  const dados = JSON.parse(await ler("dados/personagens.json"));
  const home = semComentarios(await ler("index.html")).split('id="personagem"')[1].split("</section>")[0];
  assert.equal((home.match(/class="video persona-card"/g) || []).length, dados.personagens.length);
  const pag = semComentarios(await ler("personagens.html"));
  for (const p of dados.personagens) {
    const linha = pag.split(`id="persona-${p.slug}"`)[1].split('<li class="publi-marca"')[0];
    for (const v of p.videos.filter((x) => x.status === "publicado")) assert.ok(linha.includes(v.codigo) || v.codigo === p.destaque, `${p.slug}: ${v.codigo}`);
  }
});

// 01/11 (2º pedido): entre a seção Personagens e Filmes entrou a página só de personagens (modelo 2026-11-01.2)
test("media kit: página 'Filmes e curtas' depois dos personagens", async () => {
  const js = await ler("assets/js/mediakit.js");
  assert.match(js, /\["sobre"\], \["personagem"\], \["filmes"\], \["numeros"\]/);
  const modelo = JSON.parse(await ler("tests/modelo/media-kit-modelo.json"));
  assert.equal(modelo.versao, "2026-11-01.4"); // 01/11: a página Personagens do PDF é a seção do site (padrão novo)
  assert.deepEqual(modelo.paginas.map((p) => p.secoes[0]), ["inicio", "links", "sobre", "personagem", "filmes", "numeros", "trabalhos", "audiencia", "agencia"]);
});
