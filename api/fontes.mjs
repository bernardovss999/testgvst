// Lê os seguidores do Gustavo em contadores públicos de tempo real (sem tokens).
//   Instagram → widget público da Mixerno.Space
//   TikTok    → contador da Livecounts.io (API pública TokCounter)
//   YouTube   → API pública da SocialCounts
// Cada leitura que falhar devolve null e a página mantém o último valor conhecido.

export const FONTES = {
  instagram: {
    nome: "Mixerno.Space",
    pagina: "https://mixerno.space/instagram-user-counter/gvstavocorrea",
    url: "https://mixerno.space/embed/instagram-user-counter/gvstavocorrea"
  },
  tiktok: {
    nome: "Livecounts.io",
    pagina: "https://livecounts.io/tiktok-live-follower-counter/6950765618174821381",
    url: "https://tiktok-api.tokcounter.com/user/stats/6950765618174821381"
  },
  youtube: {
    nome: "SocialCounts",
    pagina: "https://socialcounts.org/youtube-live-subscriber-count/UCPj8ZzMbaGdAbGOu11yjKqQ",
    url: "https://api.socialcounts.org/youtube-live-subscriber-count/UCPj8ZzMbaGdAbGOu11yjKqQ"
  }
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const exato = (valor) => ({ valor: Number(valor), aprox: false });
const valido = (n) => Number.isFinite(Number(n)) && Number(n) > 0;

export function lerInstagram(html) {
  const m = html.match(/class="[^"]*followers[^"]*"[^>]*>\s*([\d.,]+)/) || html.match(/followers">\s*([\d.,]+)/);
  if (!m) return null;
  const n = Number(m[1].replace(/[.,]/g, ""));
  return valido(n) ? { seguidores: exato(n) } : null;
}

export function lerTiktok(j) {
  if (!j || !j.success || !valido(j.followerCount)) return null;
  const out = { seguidores: exato(j.followerCount) };
  if (valido(j.likeCount)) out.curtidas = exato(j.likeCount);
  if (valido(j.videoCount)) out.videos = exato(j.videoCount);
  return out;
}

export function lerYoutube(j) {
  const c = j && j.counters && (j.counters.api || j.counters.estimation);
  if (!c || !valido(c.subscriberCount)) return null;
  const out = { inscritos: { valor: Number(c.subscriberCount), aprox: true } };
  if (valido(c.viewCount)) out.visualizacoes = exato(c.viewCount);
  if (valido(c.videoCount)) out.videos = exato(c.videoCount);
  return out;
}

async function obter(url, tipo, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": UA, accept: tipo === "json" ? "application/json" : "text/html" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return tipo === "json" ? r.json() : r.text();
  } finally {
    clearTimeout(t);
  }
}

// Uma nova tentativa quando a fonte falha ou responde sem número
async function tentar(fn) {
  try {
    const r = await fn();
    if (r) return r;
  } catch { /* tenta de novo */ }
  return fn();
}

export async function lerSeguidores() {
  const [ig, tt, yt] = await Promise.allSettled([
    tentar(() => obter(FONTES.instagram.url, "html").then(lerInstagram)),
    tentar(() => obter(FONTES.tiktok.url, "json").then(lerTiktok)),
    tentar(() => obter(FONTES.youtube.url, "json").then(lerYoutube))
  ]);
  const v = (p) => (p.status === "fulfilled" ? p.value : null);
  return { instagram: v(ig), tiktok: v(tt), youtube: v(yt) };
}

// Junta a leitura ao vivo com a base (dados/metricas.json), mantendo o que não veio ao vivo.
export function mesclar(base, aoVivo, agora = new Date()) {
  const dados = JSON.parse(JSON.stringify(base));
  let algum = false;
  for (const [plat, campos] of Object.entries(aoVivo)) {
    if (!campos) continue;
    Object.assign(dados.plataformas[plat], campos);
    algum = true;
  }
  if (algum) dados.atualizadoEm = agora.toISOString();
  dados.aoVivo = Object.fromEntries(Object.entries(aoVivo).map(([k, c]) => [k, Boolean(c)]));
  return dados;
}
