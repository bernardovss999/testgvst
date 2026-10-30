// GET /api/seguidores — números ao vivo já mesclados com dados/metricas.json.
// Funciona no servidor local (tests/servidor.js) e como função serverless (Vercel/Netlify).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { lerSeguidores, mesclar } from "./fontes.mjs";

const BASE = fileURLToPath(new URL("../dados/metricas.json", import.meta.url));
const CACHE_MS = 15000;
let cache = { em: 0, dados: null };

export async function seguidoresAoVivo(ler = lerSeguidores) {
  if (cache.dados && Date.now() - cache.em < CACHE_MS) return cache.dados;
  const base = JSON.parse(await readFile(BASE, "utf8"));
  const dados = mesclar(base, await ler());
  cache = { em: Date.now(), dados };
  return dados;
}

export function limparCache() { cache = { em: 0, dados: null }; }

export default async function handler(req, res) {
  const dados = await seguidoresAoVivo();
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(dados));
}
