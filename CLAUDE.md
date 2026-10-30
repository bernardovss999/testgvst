# Site Gustavo Correa (@gvstavocorrea) — prévia

Site estático (HTML/CSS/JS puro) + uma rota `/api/seguidores` para o contador ao vivo. Conteúdo: Media Kit 2026 atualizado com pesquisa pública (out/2026).

## Direção visual (pedido do cliente)
- Sóbrio, monocromático (cinzas + tinta). Referências: Behance ProTip, Influence Code, Blurred Unboxing, Salimon.
- Uma família: Archivo (eixo wdth) para tudo; Space Mono só em rótulos. Instrument Serif SOMENTE na palavra em destaque do topo (`.destaque`, hoje "lifestyle", com o rabisco azul).
- "GUSTAVO" e "CORREA" na mesma fonte. Sem eyebrow "Criador de conteúdo · Rio de Janeiro".
- O personagem "homem performático" é o diferencial principal (seção logo após o topo), mas o site mostra outros territórios também.
- Ordem atual (29/10): topo com números → marcas → links → sobre ("Vivências e umas bobeiras") → personagem → números ao vivo → publis → audiência → agência → contato.
- Contador: soma de seguidores das três redes, ao vivo, via contadores públicos (Mixerno.Space, Livecounts.io, SocialCounts). NÃO usar tokens/APIs oficiais.

## Estrutura
- `index.html` (home), `publis.html` (página dedicada com todas as publis), `assets/css/style.css`, `assets/js/main.js`.
- `api/fontes.mjs` (leitura das fontes públicas) e `api/seguidores.mjs` (rota com cache de 15 s).
- `dados/metricas.json` — reserva; `#metricas-iniciais` no HTML precisa bater com ele (teste).
- `assets/img/raw/` — originais do PDF do Media Kit.

## Testes
- `npm test` roda tudo (node:test + Playwright). Os testes de navegador usam `SEM_REDE` e simulam a API, então não dependem da internet.
- Dependências ficam FORA do Google Drive: `npm run deps` instala em `%LOCALAPPDATA%\gustavo-correa-site-deps`.
- Regressões em `tests/regression/`, um arquivo por bug.
- Prévia local: `npm run servir` → http://127.0.0.1:4173/ (no app, o launch.json da pasta FOTOS 360 GRAUS sobe o mesmo servidor).

## Vídeos e publis
- Player (`.player[data-tiktok]` ou `[data-instagram]`) mostra a capa e só carrega o embed (TikTok player v1 / Instagram embed) no clique.
- Capas em `assets/img/videos/<id>.webp`; logos das marcas em `assets/img/marcas/` (em escala de cinza nas publis; COLORIDOS na faixa "Marcas que já colaboramos", pedido do cliente).
- Publis são GERADAS: editar a lista `MARCAS` em `scripts/gerar-publis.py` e rodar `python scripts/gerar-publis.py`. Ele reescreve, entre `<!-- PUBLIS:INICIO -->` e `<!-- PUBLIS:FIM -->`, a lista completa em `publis.html` e a faixa compacta da home (um reel por marca passando na horizontal, nome embaixo, link para `publis.html#marca-<slug>`), além do letreiro "Marcas que já colaboramos". Não editar esses trechos à mão.
- Fora do site a pedido do cliente (29/10): Coca-Cola, Voe Nuvy, Bold Snacks, a seção "Eventos e convites", o vídeo do Zeca nos mais vistos e os cards GVST Apparel / Expedição Caraíva.
- Capas do Instagram: `assets/img/videos/ig-<codigo>.webp`. O Gustavo oculta curtidas no Instagram; quando o mesmo vídeo está no TikTok, a métrica usada é a view do TikTok (conferido pela capa e data).
- Bagaggio e Zerezes ainda sem link do reel (usam o print do Media Kit e o perfil). Quando o cliente mandar, trocar para `"ig"` na lista e remover a exceção `SEM_LINK_AINDA` do teste.
- Classe `.marca` é o logo do menu; a linha de publi é `.publi-marca` (regressão em `tests/regression/logo-menu-com-estilo-de-publi.test.js`).

## SEO
- Prévia usa URLs relativas e `noindex`. `npm run publicar -- https://dominio` gera `dist/` com canonical/OG/JSON-LD absolutos, sem noindex, com `sitemap.xml` e `robots.txt` liberado.
- JSON-LD: ProfilePage + Person + VideoObject. Título ≤ 60 caracteres.

## Pendências para publicar
- Prévia com `noindex` e `robots.txt` bloqueando; liberar ao publicar.
- Hospedagem precisa suportar a função `api/seguidores.mjs` (ex.: Vercel); sem ela o site cai para `dados/metricas.json`.
- Confirmar relação MUDAH × MOOTS.

## Mobile (camada final)
- `assets/css/mobile.css` carrega depois do `style.css`: refinamento ≤ 640px, barra fixa (`#dock`) e a barra/selo de "nível de performance" (desktop + mobile).
- Menu do celular (≤ 960px, onde existe o botão de menu): o painel desce e as opções entram uma a uma (`menu-painel`/`menu-opcao` no fim do `mobile.css`); desktop sem animação e "reduzir movimento" desliga.
- Topo proporcional (fim do `mobile.css`): nome, frase dos territórios ("Humor, lifestyle, wellness e moda."), foto, números e marcas cabem na primeira tela; tamanhos escalam com `svh`. No celular/tablet (≤ 960px) o nome fica em cima e texto à esquerda + foto à direita. Regressão: `tests/regression/marcas-fora-da-primeira-tela.test.js`.
- Vídeos do fundo (`.vitrine`) ficam direto no `.hero` e cobrem o topo inteiro (desktop e celular), desfocados (`blur`) e com véu claro; faixa de seguidores compacta. Regressão: `tests/regression/videos-so-atras-da-foto.test.js`.
- Testes em `tests/mobile.test.js` (320/360/390/430px: sem vazamento lateral, toque ≥ 44px, texto ≥ 11px, carrosséis, barra fixa, autoplay do fundo, player).
- `npm test` roda com `--test-concurrency=2` para não estourar tempo em máquinas lentas.
- Pedidos de 29/10 (depois de ver no iPhone): "Publis" no menu da home abre `publis.html` (todas as publis), não a faixa `#trabalhos`; a primeira tela do celular é só o topo (no Safari a página aparece atrás da barra de baixo, então a faixa escura das marcas ganha `100lvh - 100svh` de sobra embaixo, ≤ 960px); rótulos da faixa de seguidores quebram em duas linhas no celular (≤ 640px, `text-wrap: balance`) em vez de cortar. Regressões: `menu-publis-leva-para-a-home`, `topo-mostra-a-secao-seguinte-no-iphone`, `rotulo-seguidores-somados-cortado`.

## Reunião de 29/10 (pendências)
- Cupom da Tuyo GVST10 (10% no site) ativo; falta o link da loja para o botão "Ir pra loja".
- Letreiro "Marcas que já colaboramos": ordem na lista `LETREIRO` do gerador (alterna marca muito famosa e menos conhecida).
- Home: cada reel da faixa de publis tem embaixo a ficha da marca (logo, nome, categoria, descrição, selo).
- Topo: o cliente pode mandar outra frase no lugar de "O homem performático"; novas fotos de ensaio entram no topo quando chegarem.
- Dados da audiência são manuais (Media Kit): revisar a cada 2 meses (próxima: fim de dez/2026). Atualização automática exige acesso às contas (Meta/TikTok), fora do escopo "sem tokens".
- Confirmar com o cliente se "Sobre" e "Audiência" sobem na página.
- Mobile "como um Reels" (≤ 640px, fim do `mobile.css` + `autodeslize`/`soltarReacoes` no `main.js`): rolagem LIVRE (o encaixe travava, cliente reclamou), seções mais compactas, conteúdo entra com impulso, carrosséis (galeria, vídeos, publis) andam sozinhos e param no toque ou quando um vídeo abre, reações sobem da coluna de atalhos à direita. "Reduzir movimento" desliga tudo. Regressões: `tests/regression/pedidos-da-reuniao-29-10*.test.js`.

## Media kit em PDF (padrão definido em 29/10)
- Botões `[data-imprimir]` na home (banner nos Links e "Media kit em PDF" no contato); a página de publis manda para `index.html?kit=1`.
- `assets/js/mediakit.js` abre uma cópia invisível `index.html?pdf=1` (1440 x 900 = layout de desktop, classe `modo-pdf`: sem cabeçalho, topo com a altura exata da página, "Media kit atualizado" + data no lugar dos botões "Enviar proposta"/"Ver links", faixas viram grades), fotografa cada seção com `html-to-image` e monta o PDF com `jsPDF` (ambos em `assets/js/vendor/`, MIT).
- Padrão: A4 DEITADO, na LARGURA TODA, com o fundo da página na cor da seção; o plano de páginas é o MODELO FIXO (ver seção abaixo), cada item inteiro na sua página (encolhe se precisar). O rodapé vai na página do contato.
- Personagem no PDF: sem o título "O homem performático" e sem o Performômetro, numa página só (5 vídeos na fileira); ele não quer ficar preso a esse personagem. No site a seção segue igual.
- Links clicáveis no PDF (`linksDoGrupo`): marcas e publis -> `publis.html#marca-...`, "Ver todas as publis", redes, cupons (loja), vídeos e "Enviar proposta" -> e-mail comercial. As logos do letreiro também são links no site. Igual em qualquer celular ou computador (não depende do diálogo de impressão, que no Windows virava layout de tablet).
- Fontes do Google são embutidas pelo próprio script (subconjuntos latinos) e os ícones `<use>` são copiados para dentro do SVG antes da foto.
- Regras do modo PDF em `assets/css/impressao.css` (também valem no Ctrl+P via `beforeprint`). Testes: `tests/regression/pedidos-da-reuniao-29-10-parte-3.test.js`.
- Sublinhado de "lifestyle": traço medido na fonte real (`desenharRabisco` no `main.js`), ondulado, colado embaixo da palavra e com uma volta só sob a perna do "y".
- Acabamento do PDF (sem "errinhos"): corta a fileira de transição do pé de cada foto (`EMENDA`, evita fio na junção de seções), a sobra de página leva a cor da borda do pedaço e as laterais esticam a borda da própria imagem (sem moldura/listras); MUDAH divide a página com o contato (definido no modelo). No modo PDF, Sobre, Publis e Audiência são compactados para caber numa página (fotos/capas quadradas, sem a descrição longa das publis, mais vistos menores). `GVST.relatorioPdf` registra cada página para os testes.

## Media kit: MODELO FIXO (pedido do cliente, 29/10) — não alterar sem pedido dele
- O PDF aprovado em 29/10/2026 é a base imutável de todos os próximos: `MODELO` em `assets/js/mediakit.js` (8 páginas A4 deitadas: topo · links · sobre · personagem · números · publis · audiência · MUDAH+contato+rodapé). Só os dados mudam na geração (seguidores, métricas ao vivo, data "Media kit atualizado"); se uma seção crescer, ela encolhe para caber na mesma página.
- Referência gravada: `tests/modelo/media-kit-modelo.json` (plano + escala de cada página) e `tests/modelo/media-kit-modelo-2026-10-29.pdf`. `tests/regression/media-kit-modelo-fixo.test.js` falha se uma geração sair do modelo. Para mudar o modelo: só com pedido do cliente; alterar `MODELO`, subir `versao` e regravar o JSON e o PDF.
- O PDF vem SEMPRE do servidor (`/api/media-kit`, mesmo Chromium): gerado no próprio iPhone/Safari (WebKit) ele sai quebrado (fotos em branco, números "000.000", fonte errada). Na Vercel: `api/media-kit.mjs` (puppeteer-core 23.10.4 + @sparticuz/chromium 131.0.1, `vercel.json` com 60 s / 1769 MB); localmente: rota em `tests/servidor.js` com o Chromium do Playwright; núcleo comum em `api/media-kit-core.mjs`.
- Se o servidor falhar: no Chrome/Edge/Android o botão monta no aparelho (mesmo motor = mesmo resultado); no Safari/Firefox avisa "Não deu para gerar..." em vez de entregar PDF quebrado.
- Emoji com a fonte Noto Color Emoji embutida (só os emojis da página) e downloads de fonte com prazo de 10 s (antes travava para sempre com a rede engasgada).
- `tests/playwright.js` exporta chromium, webkit e firefox (WebKit instalado nas deps; o download do Firefox falhou e ele não é usado nos testes).
- Na Vercel (testgvst.vercel.app) a função dava 502 "libnss3.so not found": o @sparticuz/chromium só extrai as libs do Amazon Linux quando vê `AWS_EXECUTION_ENV`/`AWS_LAMBDA_JS_RUNTIME`, que a Vercel não define. `ambienteDaVercel` em `api/media-kit.mjs` define `AWS_LAMBDA_JS_RUNTIME=nodejs22.x` antes do import. Regressão: `tests/regression/media-kit-vercel-sem-libnss3.test.js`. Depois do deploy, conferir `curl https://<dominio>/api/media-kit` (precisa responder application/pdf).
