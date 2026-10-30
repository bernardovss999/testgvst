// Grava em dados/metricas.json uma leitura dos contadores públicos (Mixerno.Space, Livecounts.io, SocialCounts).
// Serve de base e de reserva quando o site estiver em hospedagem sem a rota /api/seguidores.
// Uso: npm run metricas
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { lerSeguidores, mesclar } from "../api/fontes.mjs";

const ARQUIVO = fileURLToPath(new URL("../dados/metricas.json", import.meta.url));

export async function atualizar() {
  const base = JSON.parse(await readFile(ARQUIVO, "utf8"));
  const aoVivo = await lerSeguidores();
  const dados = mesclar(base, aoVivo);
  delete dados.aoVivo;
  for (const [plat, ok] of Object.entries(aoVivo)) console.log(`${ok ? "✓" : "✗"} ${plat}${ok ? "" : " (mantido o último valor)"}`);
  await writeFile(ARQUIVO, JSON.stringify(dados, null, 2) + "\n");
  return dados;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  atualizar().catch((e) => { console.error(e); process.exit(1); });
}
