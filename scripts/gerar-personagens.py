# Gera os personagens e os filmes a partir de dados/personagens.json e dados/filmes.json:
#  - index.html: um vídeo de cada personagem dentro de #personagem (<!-- PERSONAGENS -->),
#    e a seção #filmes (<!-- FILMES -->); o media kit fotografa essas mesmas seções
#  - personagens.html: página com todos os personagens e a lista completa de vídeos (<!-- PERSONAGENS:INICIO/FIM -->)
# Desde 01/11 (pedido do cliente) a home só mostra um vídeo de cada personagem; personagens.html tem todos os vídeos.
# Uso: python scripts/gerar-personagens.py   (--verificar: só confere se o HTML está em dia com os dados)
import html
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
IG = "https://www.instagram.com/gvstavocorrea/reel/"
TT = "https://www.tiktok.com/@gvstavoccorrea/video/"
MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
NA_HOME = 4  # vídeos por personagem na home (o destaque é o primeiro)

e = html.escape


def mes(iso):
    a, m, _ = iso.split("-")
    return f"{MESES[int(m) - 1]} {a}"


def publis():
    # reel que já está em Publis (scripts/gerar-publis.py) leva o selo e o link da marca, sem repetir a ficha
    fonte = (RAIZ / "scripts" / "gerar-publis.py").read_text(encoding="utf-8")
    achados, marca = {}, None
    for linha in fonte.splitlines():
        m = re.search(r'"nome": "([^"]+)"', linha)
        if m:
            marca = m.group(1)
        for cod in re.findall(r"reel/([\w-]+)", linha):
            achados.setdefault(cod, marca)
    return achados


def slug(nome):
    return re.sub(r"[^a-z0-9]+", "-", nome.lower().replace("é", "e").replace("á", "a")).strip("-")


def player(attr, capa, w, h, titulo, alt):
    return (f'<div class="player" {attr}>\n'
            f'                  <img src="assets/img/videos/{capa}" width="{w}" height="{h}" loading="lazy" alt="{e(alt)}">\n'
            f'                  <button class="player__play" type="button" aria-label="Assistir {e(titulo)} aqui no site"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg></button>\n'
            f'                </div>')


def video_ig(v, personagem, marcas, classe="video", tag="li"):
    cod = v["codigo"]
    meta = f"<strong>{e(v['views'])}</strong> · {mes(v['data'])}" if v.get("views") else f"Instagram · {mes(v['data'])}"
    links = [f'<a class="video__link" href="{IG}{cod}/" target="_blank" rel="noopener">Ver no Instagram</a>']
    if cod in marcas:
        links.append(f'<a class="video__link" href="publis.html#marca-{slug(marcas[cod])}">Publi {e(marcas[cod])}</a>')
    return f"""              <{tag} class="{classe}">
                {player(f'data-instagram="reel/{cod}"', f"ig-{cod}.webp", 360, 640, v["titulo"], f"Capa do vídeo {v['titulo']} ({personagem})")}
                <div class="video__info">
                  <p class="video__t">{e(v['titulo'])}</p>
                  <p class="video__meta">{meta}</p>
                  <p class="video__links">{' '.join(links)}</p>
                </div>
              </{tag}>"""


def video_tt(t, personagem):
    links = [f'<a class="video__link" href="{TT}{t["id"]}" target="_blank" rel="noopener">Ver no TikTok</a>']
    if t.get("ig"):
        links.insert(0, f'<a class="video__link" href="{IG}{t["ig"]}/" target="_blank" rel="noopener">Ver no Instagram</a>')
    return f"""              <li class="video">
                {player(f'data-tiktok="{t["id"]}"', f"{t['id']}.webp", 337, 600, t["titulo"], f"Capa do vídeo {t['titulo']} ({personagem})")}
                <div class="video__info">
                  <p class="video__t">{e(t['titulo'])}</p>
                  <p class="video__meta"><strong>{e(t['views'])}</strong> · {t['mes']}</p>
                  <p class="video__links">{' '.join(links)}</p>
                </div>
              </li>"""


def publicados(p):
    vids = [v for v in p["videos"] if v["status"] == "publicado"]
    vids.sort(key=lambda v: v["codigo"] != p["destaque"])  # destaque primeiro, o resto do mais recente ao mais antigo
    return vids


def pendentes(p):
    fora = [v for v in p["videos"] if v["status"] != "publicado"]
    if not fora:
        return ""
    itens = "\n".join(f"                 - {IG}{v['codigo']}/ ({v['data']}{', ' + v['views'] if v.get('views') else ''})" for v in fora)
    return f"\n              <!-- TODO: confirmar com Zach antes de entrar na grade:\n{itens}\n              -->"


def descricao(p, classe):
    if p.get("descricao"):
        return f'<p class="{classe}">{e(p["descricao"])}</p>'
    return "<!-- TODO: Zach revisar descrição -->"


def home(dados, marcas):
    # seção Personagens da home: um vídeo de cada personagem (o destaque), na ordem do arquivo de dados;
    # todos os vídeos ficam em personagens.html
    cards = []
    for p in dados["personagens"]:
        if p.get("tiktok"):
            t = p["tiktok"][0]
            links = [f'<a class="video__link" href="{IG}{t["ig"]}/" target="_blank" rel="noopener">Ver no Instagram</a>',
                     f'<a class="video__link" href="{TT}{t["id"]}" target="_blank" rel="noopener">Ver no TikTok</a>']
            tit, cod, meta = t["titulo"], t["ig"], f"<strong>{e(t['views'])}</strong> · {t['mes']}"
        else:
            v = publicados(p)[0]
            tit, cod = v["titulo"], v["codigo"]
            meta = f"<strong>{e(v['views'])}</strong> · {mes(v['data'])}" if v.get("views") else f"Instagram · {mes(v['data'])}"
            links = [f'<a class="video__link" href="{IG}{cod}/" target="_blank" rel="noopener">Ver no Instagram</a>']
        links.append(f'<a class="video__link" href="personagens.html#persona-{p["slug"]}">Todos os vídeos</a>')
        cards.append(f"""            <li class="video persona-card" id="persona-{p['slug']}">
            <h3 class="persona-card__nome">{e(p['nome'])}</h3>
            {player(f'data-instagram="reel/{cod}"', f"ig-{cod}.webp", 360, 640, tit, f"Capa do vídeo {tit} ({p['nome']})").replace(chr(10) + "                ", chr(10) + "            ")}
            <div class="video__info">
              <p class="video__t">{e(tit)}</p>
              <p class="video__meta">{meta}</p>
              <p class="video__links">{' '.join(links)}</p>
            </div>{pendentes(p).replace(chr(10) + "              ", chr(10) + "            ")}
          </li>""")
    return ("<!-- PERSONAGENS:INICIO -->\n"
            '          <ul class="grade-videos personagens-home">\n' + "\n".join(cards) + "\n          </ul>\n"
            "          <!-- PERSONAGENS:FIM -->")


def pagina_personagens(dados, marcas):
    linhas = []
    for p in dados["personagens"]:
        vids = publicados(p)
        itens = [video_tt(t, p["nome"]) for t in p.get("tiktok", [])]
        if p.get("tiktok"):
            vids = [v for v in vids if v["codigo"] != p["destaque"]]
        itens += [video_ig(v, p["nome"], marcas) for v in vids]
        n = len(itens)
        linhas.append(f"""          <li class="publi-marca" id="persona-{p['slug']}">
            <div class="marca__info">
              <h2 class="marca__nome">{e(p['nome'])}</h2>
              <p class="marca__cat">{"Personagem principal" if p.get("principal") else "Personagem"}</p>
              {descricao(p, "marca__desc")}
              <p class="marca__resumo">{n} {"vídeo" if n == 1 else "vídeos"}</p>
            </div>
            <ul class="marca__videos">
{chr(10).join(itens)}
            </ul>{pendentes(p)}
          </li>""")
    return ("<!-- PERSONAGENS:INICIO -->\n        <ul class=\"marcas\">\n" + "\n".join(linhas)
            + "\n        </ul>\n        <!-- PERSONAGENS:FIM -->")


def filme(f):
    if f["status"] != "publicado":
        # card pronto em dados/filmes.json; entra no site (na posição pela data) quando o status virar "publicado"
        return (f"            <!-- TODO: Zach enviar link, data e views. Card de \"{f['titulo']}\" ({f['nota']}) pronto em dados/filmes.json:\n"
                "                 preencher codigo, data (AAAA-MM-DD) e views, mudar status para \"publicado\", baixar a capa para\n"
                "                 assets/img/videos/ig-<codigo>.webp (360x640) e rodar python scripts/gerar-personagens.py -->")
    cod = f["codigo"]
    meta = f"<strong>{e(f['views'])}</strong> · {mes(f['data'])}" if f.get("views") else f"Instagram · {mes(f['data'])}"
    creditos = f'\n                <p class="filme__creditos">{e(f["creditos"])}</p>' if f.get("creditos") else ""
    return f"""            <li class="video filme">
              {player(f'data-instagram="reel/{cod}"', f"ig-{cod}.webp", 360, 640, f["titulo"], f"Capa do curta {f['titulo']}").replace(chr(10) + "                ", chr(10) + "              ")}
              <div class="video__info">
                <p class="video__t">{e(f['titulo'])}</p>
                <p class="filme__nota">{e(f['nota'])}</p>
                <p class="video__meta">{meta}</p>{creditos}
                <a class="video__link" href="{IG}{cod}/" target="_blank" rel="noopener">Ver no Instagram</a>
              </div>
            </li>"""


def filmes(dados):
    # mais recente primeiro; sem data (aguardando link) fica no fim até chegar
    lista = sorted(dados["filmes"], key=lambda f: f["data"] or "", reverse=True)
    lista.sort(key=lambda f: f["data"] is None)
    candidatos = "\n".join(f"             - {c}" for c in dados["candidatos"])
    return ("<!-- FILMES:INICIO -->\n"
            '          <ul class="grade-videos grade-videos--4 filmes">\n'
            + "\n".join(filme(f) for f in lista) + "\n"
            "          </ul>\n"
            "          <!-- TODO: confirmar com Zach se entram em Filmes e curtas:\n" + candidatos + "\n          -->\n"
            "          <!-- FILMES:FIM -->")


def trocar(texto, marcador, bloco):
    novo, n = re.subn(rf"<!-- {marcador}:INICIO -->.*?<!-- {marcador}:FIM -->", lambda _: bloco, texto, flags=re.S)
    if n != 1:
        raise SystemExit(f"marcadores {marcador} não encontrados")
    return novo


def main():
    pers = json.loads((RAIZ / "dados" / "personagens.json").read_text(encoding="utf-8"))
    fil = json.loads((RAIZ / "dados" / "filmes.json").read_text(encoding="utf-8"))
    marcas = publis()
    saidas = {
        "index.html": lambda s: trocar(trocar(s, "PERSONAGENS", home(pers, marcas)), "FILMES", filmes(fil)),
        "personagens.html": lambda s: trocar(s, "PERSONAGENS", pagina_personagens(pers, marcas)),
    }
    desatualizado = []
    for nome, gerar in saidas.items():
        arq = RAIZ / nome
        atual = arq.read_text(encoding="utf-8")
        novo = gerar(atual)
        if "--verificar" in sys.argv:
            if novo != atual:
                desatualizado.append(nome)
        else:
            arq.write_text(novo, encoding="utf-8", newline="")
    if desatualizado:
        raise SystemExit("HTML desatualizado em relação aos dados: " + ", ".join(desatualizado) + " (rode python scripts/gerar-personagens.py)")
    print(f"{len(pers['personagens'])} personagens, {sum(f['status'] == 'publicado' for f in fil['filmes'])} filmes publicados")


if __name__ == "__main__":
    main()
