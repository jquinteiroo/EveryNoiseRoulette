# EveryNoiseRoulette — investigação de viabilidade de dados e reprodução

**Data:** 16 de outubro de 2026  
**Status:** pesquisa documental; sem teste de ponta a ponta aprovado  
**Decisão:** **não** alterar o site de produção nem prometer reprodução dos 5.925 gêneros antes de validar catálogo, direitos e player.

## 1. Problema a resolver

Experiência desejada: sortear qualquer microgênero, iniciar de imediato uma faixa **realmente representativa**, preferencialmente num ponto interessante, continuar até o usuário clicar em Próxima.

Separar três problemas:
1. **Taxonomia:** uma lista de gêneros não fornece músicas.
2. **Curadoria:** artista associado a um gênero não implica que toda faixa sua pertença ao gênero.
3. **Reprodução:** um nome/ID de faixa não autoriza streaming nem garante que o embed funcione.

Falhas observadas na implementação anterior: pesquisa textual confundiu artista Fiji com `fijian pop`, música chamada Country Dawn com `country dawn`, e a busca dinâmica por artistas frequentemente não resolveu o gênero. A mensagem final ocultava erros reais; a cota de pesquisa não escala para milhares de sorteios.

## 2. Fontes investigadas

| Fonte | Dados de que dispõe / afirma dispor | Limitação relevante | Próxima verificação |
|---|---|---|---|
| [Geeoon / EveryNoise-Genre-JSON](https://github.com/Geeoon/EveryNoise-Genre-JSON) | Lista JSON de gêneros, já importada no projeto: 5.925 | Não associa gêneros, artistas, músicas ou players | Manter como catálogo nominal, sem tratar como catálogo reproduzível |
| [Every Noise at Once](https://everynoise.com/) | Mapa histórico de ~6.291 gêneros, artistas, playlists e amostras em sua própria interface (conforme relatos e documentação) | O projeto deixou de ter atualização regular após 2023; nosso acesso automatizado ao site e a páginas individuais **não foi comprovado**; direitos de redistribuição de previews não verificados | Verificar páginas reais e pedir permissão quando necessário, sem reutilizar MP3 como produto |
| [trebi / music-genres-dataset](https://github.com/trebi/music-genres-dataset) | Autor relata **1.494 gêneros × 200 faixas**, com artistas, títulos e ranking. Arquivo data.zip de 64,2 MB em Git LFS | **Conteúdo, abrangência real, data, deduplicação e licenças de dados derivados ainda não auditados**. Licença de código não garante direitos sobre mídia ou dados de terceiros | Obter ZIP, analisar schema e comparar os gêneros com os 5.925 nomes |
| [Not Every Noise at Once](https://noteverynoise.com/) | Base de associação artista–gênero com 778 gêneros e afirmação de ~1,8 milhão de artistas; atualização indicada em 18/08/2026 | Cobertura limitada, modelo diferente do Every Noise, direitos/reuso e qualidade não auditados | Conferir exemplos e política de reuso, apenas como enriquecimento |
| [aweitz / EveryNoise](https://github.com/aweitz/EveryNoise) | Scrapers históricos de páginas individuais, gênero → artista, por volta de 2016 | Cobertura antiga; não é garantia de base atual completa | Só referencial de formato de HTML |
| [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) | Artistas, recordings, relacionamentos; alguns metadados de gênero/tags | Limite de 1 chamada/s por cliente; taxonomia não cobre necessariamente microgêneros do Every Noise; **tags/gêneros são dados suplementares sob CC BY-NC-SA**, não CC0 | Avaliar identificação/desambiguação de artista e título; checar licença de uso |

### Uma pista mais importante que a busca atual

O dataset de **trebi** tem registros de **gênero → faixa → artista**, e não apenas nome de gênero ou `gênero → artista`. Isso elimina uma parte da ambiguidade: ainda precisamos conferir que o conteúdo está disponível, que os vínculos são precisos e que há direitos adequados para a reutilização dos metadados.

Fontes verificadas:
- https://github.com/trebi/music-genres-dataset (README, data.zip 64,2 MB sob Git LFS)
- https://github.com/Geeoon/EveryNoise-Genre-JSON
- https://noteverynoise.com/
- https://musicbrainz.org/doc/About/Data_License
- https://musicbrainz.org/doc/MusicBrainz_Database

## 3. Reprodução e licenças

- **Spotify:** `preview_url` está depreciado e seus previews **não podem ser oferecidos como um serviço independente**. O embed oficial é possível, mas não garante autoplay, início arbitrário ou faixa completa para todas as pessoas. A reprodução musical pela plataforma está sujeita a regras específicas (incluindo Premium em modalidades de streaming).
  - https://developer.spotify.com/policy
  - https://developer.spotify.com/documentation/embeds
  - https://developer.spotify.com/documentation/embeds/references/iframe-api
- **YouTube:** player oficial visível e conteúdo permitido para incorporação pode servir para faixa inteira e seek. Encontrar uma faixa certa por nome do gênero **não é curadoria**. É melhor mapear previamente artista + título + vídeo ID com revisão, sem ocultar o vídeo/extrair áudio.
  - https://developers.google.com/youtube/iframe_api_reference
  - https://developers.google.com/youtube/terms/api-services-terms-of-service
- **YouTube Data API:** documentação atual informa um **limite padrão específico de 100 pesquisas `search.list` por dia**, uma unidade nesse bucket por pesquisa, em separado de outras operações. Fazer múltiplas pesquisas por clique inviabiliza o uso público; materializar IDs previamente e ter cache persistente.
  - https://developers.google.com/youtube/data/determine_quota_cost
- **Apple iTunes Search API:** previews são para **promoção da loja**, não para entretenimento independente. Não utilizar para uma roleta de streaming sem autorização específica.
  - https://performance-partners.apple.com/search-api
- **MusicBrainz:** dados essenciais CC0, mas tags/gêneros suplementares sob licença não comercial. Não misturar as duas licenças.
  - https://musicbrainz.org/doc/About/Data_License

Nenhuma destas fontes resolve sozinha 5.925 faixas completas, corretas e reproduzíveis para todos os usuários.

## 4. Hipótese de arquitetura (ainda não aprovada)

**Pipeline offline/assíncrono, não uma pesquisa a cada clique:**

```
Gêneros Every Noise (5.925)
    ↓ join exato/aliases
Catálogo de faixas representativas [gênero, artista, título, origem, confiança]
    ↓ lookup de vídeos por artista + título
Catálogo validado de vídeo IDs / Spotify URIs / links oficiais
    ↓ checagem de reprodução e bloqueios
Site: sorteio somente entre amostras validadas; catálogo completo continua explorável
```

Cada registro precisa guardar:
- `genre_id`, `genre_name`, `artist`, `track_title`;
- `source`, `source_date`, `license_review_status`, `confidence`;
- `player_provider`, `media_id`, `duration_seconds`, `suggested_start_seconds`, `last_checked_at`;
- `status`: validado / disponível-sem-player / reprovado / pendente.

Não equiparar "nome catalogado" a "reproduzível". Ao sortear um nome sem vídeo confirmado, permitir que a pessoa explore o gênero; como meta final, aumentar a taxa de áudio real, não mascarar ausência com faixas aleatórias.

## 5. Experimento obrigatório antes de retomar o frontend

1. **Descompactar e auditar** o ZIP trebi (schema real, dados íntegros, licença/datas, contagem de gêneros/nomes/duplicatas, sobreposição com os 5.925).
2. Extrair amostra **aleatória reproduzível** de 50 gêneros, estratificada entre muito obscuros, regionais e conhecidos. Incluir explicitamente `fijian pop`, `country dawn` e `us power metal`.
3. Para cada gênero, selecionar uma faixa fornecida por uma fonte verificável; auditar manualmente correspondência gênero/faixa sem deduzir estilo pelo nome.
4. Localizar um vídeo incorporável por **artista + título** em lote e validar pelo player oficial no navegador, com rastreabilidade e sem download de áudio.
5. Medir: (i) cobertura gênero→faixa; (ii) gênero→vídeo reproduzível; (iii) taxa de músicas incorretas; (iv) tempo do clique ao áudio; (v) consumo de quota; (vi) situação jurídica para lançamento público.
6. **Critério sugerido de go/no-go do piloto:** ≥80% dos 50 gêneros da amostra com música adequada e reproduzível, ≤5% de associação de gênero errada após revisão, sem violar políticas do player, sem buscas em tempo real por clique. São **metas de decisão**, não resultados alcançados.

Se a amostra não atingir os limiares: não afirmar suporte aos 5.925; investigar licenças/parcerias ou restringir a um catálogo realmente validado sem simular universalidade.

## 6. Estado real desta pesquisa

**Verificado:** existência pública do catálogo JSON, do repositório trebi com README que declara 1.494 gêneros/200 músicas e ZIP em LFS, documentação de quota, limites oficiais de previews/embeds e licença MusicBrainz.

**Não verificado:** bytes e contagens internas do ZIP; direito de reutilização dos metadados derivados; acesso ao Every Noise a partir da Netlify; correspondência entre os 1.494 e os 5.925; vídeos incorporáveis identificados para amostra aleatória; taxa de reprodução real; viabilidade do site público completo.

**Decisão atual:** bloquear implementação de novas funcionalidades, manter código existente inalterado e preparar auditoria dos dados. O próximo artefato não será uma nova interface, mas uma matriz de cobertura real auditada por gênero, com evidências.
