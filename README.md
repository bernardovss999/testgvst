# Gustavo Correa — prévia do site

## Ver a prévia
```
npm run servir
```
Abra http://127.0.0.1:4173/

## Contador ao vivo (sem tokens)
A página consulta `/api/seguidores` a cada 15 segundos. Essa rota lê contadores públicos de tempo real e soma os seguidores das três redes:

| Rede | Fonte pública | Link exibido no site |
|---|---|---|
| Instagram | Mixerno.Space (widget público) | mixerno.space/instagram-user-counter/gvstavocorrea |
| TikTok | Livecounts.io (API TokCounter) | livecounts.io/tiktok-live-follower-counter/6950765618174821381 |
| YouTube | SocialCounts (API pública) | socialcounts.org/youtube-live-subscriber-count/UCPj8ZzMbaGdAbGOu11yjKqQ |

O código está em `api/fontes.mjs`. A rota roda no servidor local e funciona como função serverless (`api/seguidores.mjs`, compatível com Vercel). Se uma fonte falhar, a página mantém o último valor (`dados/metricas.json`) e mostra "Última leitura" em vez de "Ao vivo".

O YouTube só divulga inscritos arredondados (ex.: 6 mil), então essa parcela da soma é aproximada. Métricas de período (views em 30 dias, alcance, interações) vêm do Media Kit e aparecem com *.

`npm run metricas` grava uma leitura nova em `dados/metricas.json`, que serve de reserva.
