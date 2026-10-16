# EveryNoiseRoulette 🎧

Descubra gêneros musicais no acaso: aperte **Sortear**, conheça um gênero e ouça uma faixa no player oficial do YouTube a partir de um trecho da música.

## Status do MVP

- Interface responsiva em HTML, CSS e JavaScript, sem build.
- Catálogo local de **5.925 gêneros** disponibilizado a partir do projeto [EveryNoise-Genre-JSON](https://github.com/Geeoon/EveryNoise-Genre-JSON), inspirado no [Every Noise at Once](https://everynoise.com/).
- Player visível do YouTube com botão **Sortear**, **Próxima**, **Ouvir do início** e **Favoritar**.
- Modo demonstração com uma pequena seleção de vídeos públicos identificados manualmente, sem chave de API.
- Modo de **curadoria por artista** com busca dinâmica quando `YOUTUBE_API_KEY` está configurada: sorteia apenas gêneros com artistas previamente associados; o arquivo de origem continua contendo 5.925 gêneros.
- Histórico e favoritos no `localStorage`. Reprodução não é garantida: o navegador e os detentores dos vídeos podem bloquear embeds, anúncios e autoplay.
- A busca agora exige categoria Música e indícios de faixa publicada (canal - Topic, áudio ou videoclipe oficial). Vídeos sobre discos, reviews, entrevistas e coletâneas são rejeitados.
- O botão **Não é música** bloqueia aquele vídeo neste navegador e tenta outro resultado. O bloqueio ainda não é compartilhado com outros usuários.
- A seleção conservadora pode não encontrar uma música para alguns gêneros; metadados não garantem classificação perfeita.
- A base piloto atualmente cobre **63 gêneros**, com **197 associações artista–gênero**; a meta é ampliar a cobertura de forma verificável antes de habilitar o catálogo inteiro.

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
4. Publique novamente. O site detecta a função de busca e ativa os gêneros que já contam com artistas mapeados.

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
```

O navegador carrega o tamanho total do catálogo local. No modo online, `/api/status` informa os gêneros com artistas mapeados e `/api/search?genre=...` escolhe até dois artistas associados, procura vídeos por artista e valida metadados antes de tocar. Gêneros ainda não mapeados não entram no sorteio, para reduzir resultados incompatíveis. Sem backend, o modo demonstrativo usa IDs previamente selecionados. O player é a **YouTube IFrame Player API**, nunca áudio extraído ou reprodução invisível.

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

O objetivo final é cobrir a lista de 5.925 gêneros, mas a cobertura inicial de artistas não é completa. O projeto deve exibir o número de gêneros **realmente habilitados para o sorteio**, não confundi-lo com o total catalogado. Fontes iniciais para curadoria: [fijian pop](https://www.musicmetricsvault.com/genres/fijian-pop/4761) e [country dawn](https://www.musicmetricsvault.com/genres/country-dawn/1189). Para ampliar, adicionar artistas com fontes verificáveis e revisar amostras antes de considerar cada gênero completamente validado. Artistas podem transitar entre estilos; mapear um artista aumenta a precisão, mas não basta para classificar toda a discografia.
