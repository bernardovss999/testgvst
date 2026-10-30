// GET /api/media-kit — gera o media kit em PDF no servidor (função serverless da Vercel), sempre no mesmo
// Chromium, para o arquivo seguir o modelo fixo em qualquer aparelho. Dependências só da hospedagem:
// puppeteer-core + @sparticuz/chromium (package.json). Tempo e memória da função em vercel.json.
import { ALTURA, LARGURA, gerarPdfNaPagina, nomeDoArquivo } from "./media-kit-core.mjs";

let navegador = null; // reaproveitado enquanto a função estiver "quente"

// O @sparticuz/chromium só extrai as bibliotecas do sistema (libnss3...) quando reconhece a AWS Lambda pelas
// variáveis abaixo; a Vercel roda na Lambda (Amazon Linux 2023) mas não as define, e o Chromium não abria.
export function ambienteDaVercel(env) {
  if (!env.AWS_EXECUTION_ENV && !env.AWS_LAMBDA_JS_RUNTIME) env.AWS_LAMBDA_JS_RUNTIME = "nodejs22.x";
}

async function abrirNavegador() {
  if (navegador && navegador.connected) return navegador;
  ambienteDaVercel(process.env);
  const { default: chromium } = await import("@sparticuz/chromium");
  const { default: puppeteer } = await import("puppeteer-core");
  navegador = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: LARGURA, height: ALTURA },
    executablePath: await chromium.executablePath(),
    headless: true
  });
  return navegador;
}

export default async function handler(req, res) {
  let pagina;
  try {
    const protocolo = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocolo}://${req.headers.host}/`;
    const nav = await abrirNavegador();
    pagina = await nav.newPage();
    await pagina.setViewport({ width: LARGURA, height: ALTURA });
    const pdf = await gerarPdfNaPagina(pagina, base);
    res.statusCode = 200;
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", `attachment; filename="${nomeDoArquivo()}"`);
    res.setHeader("cache-control", "no-store");
    res.end(pdf);
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ erro: String(e && e.message || e) }));
  } finally {
    if (pagina) await pagina.close().catch(() => {});
  }
}
