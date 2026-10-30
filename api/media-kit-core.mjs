// Núcleo do media kit em PDF gerado no servidor: abre a home do próprio site em 1440 x 900 (index.html?pdf=1),
// roda o mesmo gerador da página (GVST.gerarPdfAqui, assets/js/mediakit.js) e devolve o PDF.
// Sempre o mesmo motor (Chromium) = sempre o MODELO FIXO, venha o pedido de iPhone, Android ou computador.
// Usado pela função da Vercel (api/media-kit.mjs) e pelo servidor local de prévia/testes (tests/servidor.js).

export const LARGURA = 1440;
export const ALTURA = 900;

export function nomeDoArquivo(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `media-kit-gustavo-correa-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.pdf`;
}

// `pagina` é uma página já aberta em 1440 x 900 (Playwright ou Puppeteer: os dois têm goto/evaluate).
export async function gerarPdfNaPagina(pagina, base) {
  await pagina.goto(new URL("index.html?pdf=1", base).href, { waitUntil: "load", timeout: 60000 });
  const base64 = await pagina.evaluate(async () => {
    const blob = await globalThis.GVST.gerarPdfAqui();
    return await new Promise((ok) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result).split(",")[1]);
      leitor.readAsDataURL(blob);
    });
  });
  return Buffer.from(base64, "base64");
}
