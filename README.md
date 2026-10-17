# EveryNoiseRoulette 🎧

Descubra gêneros musicais no acaso: aperte **Sortear**, conheça um gênero e ouça uma faixa no player oficial do YouTube a partir de um trecho da música.

## Status do MVP

- Interface responsiva em HTML, CSS e JavaScript, sem build.
- Catálogo local de **5.925 gêneros** disponibilizado a partir do projeto [EveryNoise-Genre-JSON](https://github.com/Geeoon/EveryNoise-Genre-JSON), inspirado no [Every Noise at Once](https://everynoise.com/).
- Player visível do YouTube com botão **Sortear**, **Próxima**, **Ouvir do início** e **Favoritar**.
- Modo demonstração com uma pequena seleção de vídeos públicos identificados manualmente, sem chave de API.
- **Sorteio habilitado para os 5.925 gêneros** quando `YOUTUBE_API_KEY` estiver configurada: busca por artistas mapeados localmente em 63 gêneros; nos demais, tenta consultar a página de artistas do Every Noise, e só então pesquisa vídeos associados aos artistas no YouTube.
- Histórico e favoritos no `localStorage`. Reprodução não é garantida: o navegador e os detentores dos vídeos podem bloquear embeds, anúncios e autoplay.
- A busca agora exige categoria Música e indícios de faixa publicada (canal - Topic, áudio ou videoclipe oficial). Vídeos sobre discos, reviews, entrevistas e coletâneas são rejeitados.
- O botão **Não é música** bloqueia aquele vídeo neste navegador e tenta outro resultado. O bloqueio ainda não é compartilhado com outros usuários.
- A seleção conservadora pode não encontrar uma música para alguns gêneros; metadados não garantem classificação perfeita.
- A base local inicial tem **63 gêneros** e **197 associações artista–gênero**; **os 5.925 são sorteáveis**. Para os demais, a procura de artistas depende do acesso à página pública correspondente, que pode falhar ou estar indisponível. Não podemos garantir reprodução para todos.

## Rodar localmente

Abra um terminal na pasta do projeto:

```bash
python -m http.server 8000
```

Acesse `http://localhost:8000`. Não use `file://`, pois o navegador pode impedir a leitura de `data/genres.json`. **Sem uma função de backend, o sorteio fica restrito às músicas demonstrativas verificadas.**

## Implantar no Netlify e liberar o sorteio com curadoria de artistas

1. Importe este repositório no Netlify. O projeto não precisa de comando de build; o diretório de publicação é `.`.
2. Crie uma chave no Google Cloud com a **YouTube Data API v3** ativada.
3. Configure a variável de ambiente **`YOUTUBE_API_KEY`** no painel do Netlify. Nunca coloque essa chave no JavaScript do navegador ou no GitHub.
4. Publique novamente. O site detecta a API configurada e disponibiliza sorteio de todos os gêneros; os gêneros sem associação direta dependem de consulta externa ao Every Noise.

Para testar funções localmente, rode `npx netlify-cli dev`, a partir da raiz do projeto, com a variável de ambiente configurada. A busca dinâmica consome cota do YouTube; os artistas são sementes de curadoria e os resultados precisam de revisão contínua. A chave da API precisa ter as restrições apropriadas no Google Cloud.

## Testes

Execute com Node.js 18+:

```bash
node --test tests/*.test.mjs
```

A suíte de regressão inclui US Power Metal Gems, Fiji / fijian pop e Country Dawn / Release - Topic, além de vídeos oficiais por artista.

## Arquitetura

```text
index.html
styles.css
app.js
data/genres.json
netlify.toml
netlify/functions/status.mjs
netlify/functions/search.mjs
netlify/functions/genre-artists.mjs
tests/search.test.mjs
tests/every-noise-artists.test.mjs
netlify/functions/every-noise-artists.mjs
```

O navegador carrega os **5.925 gêneros** do JSON local. `/api/status` informa os 63 gêneros mapeados diretamente e `/api/search?genre=...` identifica artistas: no mapa local quando disponível ou, experimentalmente, no HTML da página `engenremap-NOMEDOGENERO.html` do Every Noise. Em seguida consulta até dois artistas no YouTube, validando os metadados antes de tocar. Se não conseguir identificar um artista, não toca um vídeo aleatório. Sem backend, o modo demonstrativo usa IDs previamente selecionados. O player é a **YouTube IFrame Player API**, nunca áudio extraído ou reprodução invisível.

O tempo inicial fica em torno de 40% da duração, limitado para evitar começar perto do fim. Em músicas demonstrativas existe um tempo específico cadastrado. O usuário pode voltar ao início pelo controle próprio do site.

## Créditos, direitos e limites

- Catálogo de gêneros: [Geeoon/EveryNoise-Genre-JSON](https://github.com/Geeoon/EveryNoise-Genre-JSON) (licença CC0 indicada pelo autor); dados provenientes originalmente de [Every Noise at Once](https://everynoise.com/). Não somos afiliados ao Every Noise.
- Os vídeos são reproduzidos **exclusivamente pelo player oficial do YouTube** e continuam pertencendo a seus titulares. Não fazemos download, extração de áudio, cache de mídia nem reprodução oculta.
- É uma experiência experimental. Para qualquer operação pública, revisar as políticas de API, licenças, direitos de marca e cotas.
- Nenhuma associação gênero → vídeo gerada dinamicamente deve ser presumida como musicologicamente correta.

## Ideias para próximas versões

Curadoria de vídeos por gênero, sugestões de avaliação, prevenção de vídeos inativos, histórico sincronizado, melhorias de acessibilidade e filtros de idiomas/estilos.

---

Projeto independente; inspirado na experiência de descoberta do Every Noise at Once.

## Qualidade do catálogo

Todos os 5.925 gêneros participam do sorteio, mas **sorteável não significa que existe amostra reproduzível**. 63 têm associações locais; os demais são tentados por consulta às páginas de gênero do Every Noise. O site informa quando nenhuma associação confiável puder ser confirmada. A implantação Netlify precisará ser testada para validar se a consulta externa é permitida/acessível. Fontes iniciais para curadoria: [fijian pop](https://www.musicmetricsvault.com/genres/fijian-pop/4761) e [country dawn](https://www.musicmetricsvault.com/genres/country-dawn/1189). Para ampliar, adicionar artistas com fontes verificáveis e revisar amostras antes de considerar cada gênero completamente validado. Artistas podem transitar entre estilos; mapear um artista aumenta a precisão, mas não basta para classificar toda a discografia.

## Busca por gênero ainda não mapeado

O backend consulta pontualmente uma página pública do Every Noise para tentar identificar artistas daquele estilo. A extração de nomes é experimental e depende da estrutura e disponibilidade da página, das regras do serviço e da rede da hospedagem. **Não assume que todo gênero será resolvido**. O sistema não transfere nem hospeda os MP3 do Every Noise e não deve tentar contornar restrições de acesso. Em caso de indisponibilidade, escolha outro gênero ou adicione uma associação manual auditável em `netlify/functions/genre-artists.mjs`.

**Limite de buscas atualizado (documentação Google de 15/10/2026):** `search.list` tem um teto padrão próprio de **100 chamadas/dia**, consumindo **uma unidade desse teto por requisição**; as demais operações têm sua própria cota de unidades. A implementação anterior podia fazer oito chamadas num clique, e 13 sorteios difíceis poderiam estourar esse limite. A versão atual realiza **no máximo uma busca do YouTube por sorteio**, parando imediatamente em erro de cota ou credenciais. A consulta de artistas ainda pode falhar: o sistema tenta o site original e a página pública histórica do autor em furia.com, retorna a causa técnica no campo `code` e oferece a opção de ouvir músicas demonstrativas sem API. O cache é temporário e não substitui um catálogo persistente validado. Fonte: https://developers.google.com/youtube/data/determine_quota_cost

## Diagnóstico de reprodução

- `YOUTUBE_QUOTA` (HTTP 429): limite diário atingido, aguarde o reset ou veja no Cloud Console > APIs e serviços > Cotas. O app não deve continuar buscando quando isso acontecer.
- `YOUTUBE_CREDENTIALS`: conferir permissões da API/chave Google Cloud.
- `ARTIST_SOURCE_UNAVAILABLE` (HTTP 424): não foi possível extrair os artistas da página pública do gênero. Testar acesso à origem/mirror da hospedagem.
- `NO_VERIFIED_VIDEO`: o gênero tem um artista conhecido, mas não foi encontrado um vídeo que passe nos filtros.
- O botão **Ouvir demo** usa os seis exemplos cadastrados, sem pesquisar o YouTube. Não é um substituto para a cobertura dos 5.925 gêneros.
