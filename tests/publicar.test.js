// Versão de publicação: URLs absolutas, sem noindex, sitemap e robots coerentes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prepararHtml, sitemap, robots } from "../scripts/publicar.mjs";
import { RAIZ } from "./servidor.js";

const DOM = "https://www.exemplo.com.br";

test("publicar troca URLs relativas por absolutas e tira o noindex", async () => {
  const html = prepararHtml(await readFile(join(RAIZ, "index.html"), "utf8"), DOM);
  assert.doesNotMatch(html, /noindex/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.exemplo\.com\.br\/">/);
  assert.match(html, /property="og:image" content="https:\/\/www\.exemplo\.com\.br\/assets\/img\/og-gustavo-correa\.jpg"/);
  const grafo = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
  for (const n of grafo) {
    for (const campo of ["@id", "url", "image", "thumbnailUrl"]) {
      if (typeof n[campo] === "string") assert.match(n[campo], /^https:\/\//, `${n["@type"]}.${campo} = ${n[campo]}`);
    }
  }
});

test("sitemap e robots apontam para o domínio", () => {
  assert.match(sitemap(DOM, "2026-10-21"), /<loc>https:\/\/www\.exemplo\.com\.br\/<\/loc>/);
  assert.match(robots(DOM), /Allow: \/\s+Sitemap: https:\/\/www\.exemplo\.com\.br\/sitemap\.xml/);
});
