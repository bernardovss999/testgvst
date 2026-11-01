// Gera a versão de publicação em dist/ com SEO completo para o domínio real.
// Uso: npm run publicar -- https://www.dominio.com.br
//  - troca as URLs relativas de canonical, og:url, og:image, twitter:image e JSON-LD por absolutas
//  - remove o noindex da prévia
//  - escreve robots.txt liberado e sitemap.xml
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PAGINAS = ["index.html", "publis.html", "personagens.html"];
// media-kit.html: página só para baixar o PDF, fora do sitemap e SEMPRE noindex (copiada sem passar pelo prepararHtml)
const SEMPRE_NOINDEX = ["media-kit.html", "vercel.json"];
const COPIAR = [...PAGINAS, ...SEMPRE_NOINDEX, "assets", "dados", "api"];

export function prepararHtml(html, dominio) {
  const base = dominio.replace(/\/+$/, "");
  return html
    .replace(/<meta name="robots" content="[^"]*">\s*/, "")
    .replace(/(<link rel="canonical" href=")\/([^"]*")/, `$1${base}/$2`)
    .replace(/(<meta property="og:url" content=")\/([^"]*")/, `$1${base}/$2`)
    .replace(/(content=")\/assets\//g, `$1${base}/assets/`)
    .replace(/("(?:@id|url|image|thumbnailUrl|item)": ")\/(#?[^"]*)"/g, `$1${base}/$2"`);
}

export function sitemap(dominio, hoje = new Date().toISOString().slice(0, 10)) {
  const base = dominio.replace(/\/+$/, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${hoje}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/publis.html</loc><lastmod>${hoje}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${base}/personagens.html</loc><lastmod>${hoje}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>
</urlset>
`;
}

export function robots(dominio) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${dominio.replace(/\/+$/, "")}/sitemap.xml\n`;
}

async function publicar(dominio) {
  if (!/^https:\/\/[^/]+\.[^/]+/.test(dominio || "")) throw new Error("Informe o domínio: npm run publicar -- https://www.dominio.com.br");
  const dist = join(RAIZ, "dist");
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist);
  for (const item of COPIAR) await cp(join(RAIZ, item), join(dist, item), { recursive: true, filter: (s) => !s.includes(`${join("assets", "img", "raw")}`) });
  for (const pagina of PAGINAS) {
    await writeFile(join(dist, pagina), prepararHtml(await readFile(join(RAIZ, pagina), "utf8"), dominio));
  }
  await writeFile(join(dist, "sitemap.xml"), sitemap(dominio));
  await writeFile(join(dist, "robots.txt"), robots(dominio));
  console.log(`dist/ pronto para ${dominio}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  publicar(process.argv[2]).catch((e) => { console.error(e.message); process.exit(1); });
}
