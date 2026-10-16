// Busca feita apenas no servidor: nunca exponha YOUTUBE_API_KEY ao navegador.
const cache = new Map();
const TTL = 12 * 60 * 60 * 1000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
function durationSeconds(iso) {
  if (typeof iso !== "string") return 0;
  const match = /^P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?$/.exec(iso);
  if (!match) return 0;
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
}
async function youtube(endpoint, params, key) {
  const url = new URL("https://www.googleapis.com/youtube/v3/" + endpoint);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
  url.searchParams.set("key", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(8500) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Não enviar respostas internas da API ou credenciais para o cliente.
    throw new Error(response.status === 403 ? "Cota ou permissão da API indisponível." : "Falha ao consultar o YouTube.");
  }
  return data;
}
export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Método não permitido." }, 405);
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return json({ error: "YouTube Data API ainda não configurada." }, 503);

  const genre = new URL(request.url).searchParams.get("genre")?.trim().toLowerCase() || "";
  if (!genre || genre.length > 85 || !/^[\p{L}\p{N}\s&+.,\/'()!-]+$/u.test(genre)) {
    return json({ error: "Gênero inválido." }, 400);
  }
  const cacheKey = genre;
  const stored = cache.get(cacheKey);
  if (stored && Date.now() - stored.at < TTL) return json(stored.track);
  try {
    const search = await youtube("search", {
      part: "snippet",
      type: "video",
      maxResults: 10,
      videoEmbeddable: "true",
      videoSyndicated: "true",
      safeSearch: "moderate",
      q: '"' + genre + '" music official audio',
    }, key);
    const ids = (search.items || []).map((item) => item.id?.videoId).filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id || ""));
    if (!ids.length) return json({ error: "Sem exemplos disponíveis para esse gênero." }, 404);
    const detail = await youtube("videos", { part: "snippet,contentDetails,status", id: ids.join(",") }, key);
    const blockWords = /\b(tutorial|explained|reaction|review|hour|playlist|mix|documentary|interview|guide|compilation|full album|type beat|how to)\b/i;
    const matches = (detail.items || [])
      .map((video) => {
        const seconds = durationSeconds(video.contentDetails?.duration);
        const title = video.snippet?.title || "";
        const artist = video.snippet?.channelTitle || "Canal do YouTube";
        const embeddable = video.status?.embeddable !== false;
        const playable = video.status?.privacyStatus === "public" && embeddable && seconds >= 100 && seconds <= 900;
        const matchTitle = title.toLowerCase();
        const score = (matchTitle.includes(genre) ? 4 : 0)
          + (/official audio|official video|topic/i.test(title) ? 3 : 0)
          - (blockWords.test(title) ? 6 : 0)
          - (/live|concert/i.test(title) ? 2 : 0);
        return { playable, score, title, artist, videoId: video.id, duration: seconds };
      })
      .filter((video) => video.playable)
      .sort((a, b) => b.score - a.score);
    // Não selecionar playlists, aulas ou horas de mix como se fossem uma faixa.
    const suitable = matches.find((video) => !blockWords.test(video.title));
    if (!suitable) return json({ error: "Não foi encontrada uma música adequada para esse gênero." }, 404);
    const track = {
      title: suitable.title,
      artist: suitable.artist,
      videoId: suitable.videoId,
      duration: suitable.duration,
    };
    cache.set(cacheKey, { at: Date.now(), track });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return json(track);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro na busca de vídeos." }, 502);
  }
}
