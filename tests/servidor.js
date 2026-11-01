// Servidor da prévia (npm run servir) e dos testes. Serve os arquivos estáticos e as rotas /api/seguidores e /api/media-kit.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { seguidoresAoVivo } from "../api/seguidores.mjs";
import { ALTURA, LARGURA, gerarPdfNaPagina, nomeDoArquivo } from "../api/media-kit-core.mjs";

export const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain"
};
const SEM_REDE = async () => ({ instagram: null, tiktok: null, youtube: null });
let navegadorKit = null;

// opcoes.ler: função que lê os contadores (nos testes, SEM_REDE evita depender da internet)
export function iniciar(porta = 0, opcoes = {}) {
  const ler = opcoes.ler || (process.env.GVST_SEM_REDE ? SEM_REDE : undefined);
  const srv = createServer(async (req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (caminho === "/api/seguidores") {
      try {
        const dados = await seguidoresAoVivo(ler);
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify(dados));
      } catch (e) {
        res.writeHead(502, { "content-type": "application/json" }).end(JSON.stringify({ erro: e.message }));
      }
      return;
    }
    // media kit em PDF gerado no servidor (na Vercel é api/media-kit.mjs; aqui usa o Chromium do Playwright)
    if (caminho === "/api/media-kit") {
      let pagina;
      try {
        const { chromium } = await import("./playwright.js");
        navegadorKit ||= await chromium.launch();
        pagina = await navegadorKit.newPage({ viewport: { width: LARGURA, height: ALTURA } });
        const pdf = await gerarPdfNaPagina(pagina, `http://${req.headers.host}/`);
        res.writeHead(200, { "content-type": "application/pdf", "content-disposition": `attachment; filename="${nomeDoArquivo()}"`, "cache-control": "no-store" });
        res.end(pdf);
      } catch (e) {
        res.writeHead(502, { "content-type": "application/json" }).end(JSON.stringify({ erro: e.message }));
      } finally {
        await pagina?.close().catch(() => {});
      }
      return;
    }
    // /media-kit = página de baixar o PDF (na Vercel, rewrite em vercel.json)
    const rota = caminho === "/media-kit" ? "/media-kit.html" : caminho;
    const arquivo = normalize(join(RAIZ, rota.endsWith("/") ? rota + "index.html" : rota));
    if (!arquivo.startsWith(normalize(RAIZ))) { res.writeHead(403).end(); return; }
    try {
      const corpo = await readFile(arquivo);
      res.writeHead(200, { "content-type": TIPOS[extname(arquivo)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(corpo);
    } catch {
      res.writeHead(404).end("404");
    }
  });
  // ao encerrar: derruba conexões abertas (keep-alive) e fecha o Chromium do media kit, senão o processo não termina
  const fechar = srv.close.bind(srv);
  srv.close = (cb) => { srv.closeAllConnections?.(); navegadorKit?.close().catch(() => {}); navegadorKit = null; return fechar(cb); };
  return new Promise((ok) => srv.listen(porta, "127.0.0.1", () => ok({ srv, url: `http://127.0.0.1:${srv.address().port}/` })));
}

export { SEM_REDE };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  iniciar(Number(process.env.PORT) || 4173).then(({ url }) => console.log(`Prévia em ${url}`));
}
