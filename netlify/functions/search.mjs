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
// Rejeita vídeos de colecionadores, entrevistas, listas e comentários musicais.
// O YouTube não fornece um campo explícito de "isto é uma música", portanto
// combinamos metadados e um critério de aprovação estrito.
export function evaluateMusicVideo(video, genre = "") {
  const snippet = video?.snippet || {};
  const title = String(snippet.title || "");
  const channel = String(snippet.channelTitle || "");
  const description = String(snippet.description || "");
  const duration = durationSeconds(video?.contentDetails?.duration);
  const titleText = title.toLowerCase();
  const channelText = channel.toLowerCase();
  const descriptionText = description.toLowerCase();
  if (snippet.categoryId !== "10" ||
      video?.status?.privacyStatus !== "public" ||
      video?.status?.embeddable !== true ||
      snippet.liveBroadcastContent === "live" ||
      duration < 100 || duration > 650) return null;

  const editorial = /\b(gems?|record collection|vinyl|cd haul|unboxing|podcast|interview|documentary|reaction|review|ranking|top [0-9]+|best songs|best albums|greatest hits|playlist|compilation|full album|album review|mixes|dj set|lesson|tutorial|explained|guide|how to|discography|part [0-9]+|guitar cover|drum cover|karaoke|live stream|livestream|behind the scenes|radio show)\b/i;
  if (editorial.test(title) || editorial.test(channel)) return null;

  const isTopic = /\s-\sTopic$/i.test(channel) || /provided to youtube by/i.test(description);
  const isOfficial = /\b(official\s+(audio|music video|video|visualizer|lyric video)|officially released|music video|visualizer|lyric video)\b/i.test(title);
  const hasTrackFormat = /^.{2,65}\s[-–—]\s.{2,100}$/.test(title);
  const hasMusicDescription = /\b(official (music )?video|official audio|stream(ing)? (now|on)|listen on spotify|listen to the (single|song)|new single|out now)\b/i.test(description);

  // Um nome de gênero no título NÃO é prova de que o vídeo seja uma música.
  if (!isTopic && !isOfficial && !(hasTrackFormat && hasMusicDescription)) return null;

  let score = isTopic ? 15 : 0;
  if (isOfficial) score += 10;
  if (hasTrackFormat) score += 3;
  if (hasMusicDescription) score += 2;
  if (titleText.includes(genre.toLowerCase())) score += 1;
  if (descriptionText.includes(genre.toLowerCase())) score += 1;
  if (channelText.includes(genre.toLowerCase())) score += 1;

  return { score, title, artist: channel.replace(/\s-\sTopic$/i, ""), videoId: video.id, duration };
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
  const excludedIds = new Set((new URL(request.url).searchParams.get("exclude") || "")
    .split(",").filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id)).slice(0, 20));
  if (stored && Date.now() - stored.at < TTL && !excludedIds.has(stored.track.videoId)) return json(stored.track);
  try {
    // Categoria oficial Music (10), junto de sinais de lançamento fonográfico.
    // O algoritmo é conservador: prefira não tocar nada a exibir um vídeo sobre música.
    const search = await youtube("search", {
      part: "snippet",
      type: "video",
      videoCategoryId: "10",
      maxResults: 20,
      videoEmbeddable: "true",
      videoSyndicated: "true",
      safeSearch: "moderate",
      q: '"' + genre + '" "official audio" | "official music video" | "topic"',
    }, key);
    const ids = (search.items || []).map((item) => item.id?.videoId).filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id || ""));
    if (!ids.length) return json({ error: "Sem exemplos musicais disponíveis para esse gênero." }, 404);
    const detail = await youtube("videos", { part: "snippet,contentDetails,status", id: ids.join(",") }, key);
    const excluded = excludedIds;
    const matches = (detail.items || [])
      .map((video) => evaluateMusicVideo(video, genre))
      .filter((video) => video !== null && !excluded.has(video.videoId))
      .sort((a, b) => b.score - a.score);
    const suitable = matches[0];
    if (!suitable) return json({ error: "Não encontramos uma faixa musical confiável para esse gênero." }, 404);
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
