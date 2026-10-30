// Leitura dos contadores públicos (sem rede: usa respostas de exemplo das fontes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerInstagram, lerTiktok, lerYoutube, mesclar, FONTES } from "../api/fontes.mjs";

test("Instagram: lê o número do widget da Mixerno.Space", () => {
  const html = '<div class="odometer followers">112,789</div>';
  assert.deepEqual(lerInstagram(html), { seguidores: { valor: 112789, aprox: false } });
  assert.equal(lerInstagram("<html>sem número</html>"), null);
});

test("TikTok: lê a resposta da Livecounts/TokCounter", () => {
  const j = { success: true, followerCount: 159059, likeCount: 14304780, videoCount: 554 };
  assert.deepEqual(lerTiktok(j), {
    seguidores: { valor: 159059, aprox: false },
    curtidas: { valor: 14304780, aprox: false },
    videos: { valor: 554, aprox: false }
  });
  assert.equal(lerTiktok({ success: false }), null);
});

test("YouTube: lê a SocialCounts e marca inscritos como arredondado", () => {
  const j = { counters: { api: { subscriberCount: 6000, viewCount: 390381, videoCount: 80 } } };
  const r = lerYoutube(j);
  assert.deepEqual(r.inscritos, { valor: 6000, aprox: true });
  assert.equal(r.visualizacoes.valor, 390381);
  assert.equal(lerYoutube({}), null);
});

test("mesclar mantém o último valor das fontes que falharam", () => {
  const base = { atualizadoEm: "2026-01-01T00:00:00Z", plataformas: {
    instagram: { seguidores: { valor: 1, aprox: false } },
    tiktok: { seguidores: { valor: 2, aprox: false } },
    youtube: { inscritos: { valor: 3, aprox: true } }
  } };
  const d = mesclar(base, { instagram: { seguidores: { valor: 10, aprox: false } }, tiktok: null, youtube: null }, new Date("2026-10-21T10:00:00Z"));
  assert.equal(d.plataformas.instagram.seguidores.valor, 10);
  assert.equal(d.plataformas.tiktok.seguidores.valor, 2);
  assert.equal(d.atualizadoEm, "2026-10-21T10:00:00.000Z");
  assert.deepEqual(d.aoVivo, { instagram: true, tiktok: false, youtube: false });
});

test("cada fonte tem página pública linkada no site", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const f of Object.values(FONTES)) assert.ok(html.includes(f.pagina), `link da fonte ausente: ${f.pagina}`);
});
