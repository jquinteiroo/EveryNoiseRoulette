// Nunca exponha YOUTUBE_API_KEY no frontend: todas as consultas passam pelo Netlify.
import { GENRE_ARTISTS } from "./genre-artists.mjs";

const cache = new Map();
const TTL = 12 * 60 * 60 * 1000;
const MAX_CACHE = 400;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
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
function simplify(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function recognizedArtist(video, artist) {
  const expected = simplify(artist);
  if (expected.length < 4) return false;
  const title = simplify(video?.snippet?.title);
  const rawChannel = simplify(video?.snippet?.channelTitle);
  const channel = rawChannel.replace(/(?: topic| vevo| official| official channel)$/, "").trim();
  // Somente o dono do canal (Topic/VEVO/oficial) ou o artista à esquerda
  // do separador do título. Ocorrência em hashtags/descritivo NÃO basta.
  const strongChannel = channel === expected || rawChannel === expected + " vevo";
  const titleCredits = title === expected || title.startsWith(expected + " ");
  const rawTitle = String(video?.snippet?.title || "");
  const credited = titleCredits && new RegExp("^" + artist.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&") + "\\s*[-–—|:]", "i").test(rawTitle);
  return strongChannel || credited;
}
async function youtube(endpoint, params, key) {
  const url = new URL("https://www.googleapis.com/youtube/v3/" + endpoint);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("key", key);
  const result = await fetch(url, { signal: AbortSignal.timeout(8500) });
  const body = await result.json().catch(() => ({}));
  if (!result.ok) {
    if (result.status === 403) throw new Error("Limite de buscas do YouTube ou permissão da API indisponível.");
    throw new Error("Falha temporária na busca do YouTube.");
  }
  return body;
}

export function evaluateMusicVideo(video, artist) {
  const snippet = video?.snippet || {};
  const title = String(snippet.title || "");
  const channel = String(snippet.channelTitle || "");
  const description = String(snippet.description || "");
  const duration = durationSeconds(video?.contentDetails?.duration);

  if (snippet.categoryId !== "10" ||
      video?.status?.privacyStatus !== "public" ||
      video?.status?.embeddable !== true ||
      snippet.liveBroadcastContent === "live" ||
      duration < 100 || duration > 650) return null;

  const rejected = /\b(gems?|record collection|vinyl|cd haul|unboxing|podcast|interview|documentary|reaction|review|ranking|top [0-9]+|best songs|best albums|greatest hits|playlist|compilation|full album|album review|dj set|lesson|tutorial|explained|guide|how to|discography|part [0-9]+|guitar cover|drum cover|karaoke|live stream|livestream|behind the scenes|radio show)\b/i;
  if (rejected.test(title) || rejected.test(channel)) return null;
  if (!recognizedArtist(video, artist)) return null;

  const topicChannel = /\s-\sTopic$/i.test(channel);
  const official = /\b(official\s+(audio|music video|video|visualizer|lyric video)|music video|visualizer|lyric video)\b/i.test(title);
  const trackFormat = /^.{2,75}\s[-–—]\s.{2,130}$/.test(title);
  const releaseSignals = /\b(provided to youtube by|official audio|official (music )?video|listen on spotify|listen to the (single|song)|new single|out now)\b/i.test(description);

  if (!topicChannel && !official && !(trackFormat && releaseSignals)) return null;

  const score = (topicChannel ? 12 : 0) + (official ? 10 : 0)
    + (releaseSignals ? 4 : 0) + (trackFormat ? 2 : 0)
    + (simplify(channel) === simplify(artist + " - Topic") ? 4 : 0);
  return { videoId: video.id, artist, title, duration, score };
}

async function searchArtist(artist, excluded, key) {
  const matches = await youtube("search", {
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    maxResults: 20,
    videoEmbeddable: "true",
    videoSyndicated: "true",
    safeSearch: "moderate",
    q: '"' + artist + '" official audio',
  }, key);
  const ids = (matches.items || [])
    .map((item) => item.id?.videoId)
    .filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id || "") && !excluded.has(id));
  if (!ids.length) return null;
  const details = await youtube("videos", { part: "snippet,contentDetails,status", id: ids.join(",") }, key);
  return (details.items || [])
    .map((item) => evaluateMusicVideo(item, artist))
    .filter((track) => track && !excluded.has(track.videoId))
    .sort((a, b) => b.score - a.score)[0] || null;
}
function randomizedArtists(artists) {
  const picks = [...artists];
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  return picks;
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Método não permitido." }, 405);
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return json({ error: "API do YouTube ainda não configurada." }, 503);

  const url = new URL(request.url);
  const genre = (url.searchParams.get("genre") || "").trim().toLowerCase();
  if (!Object.hasOwn(GENRE_ARTISTS, genre)) {
    return json({ error: "Este gênero ainda não tem artistas associados à nossa curadoria." }, 422);
  }
  const excluded = new Set((url.searchParams.get("exclude") || "")
    .split(",").filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id)).slice(0, 20));
  const stored = cache.get(genre);
  if (stored && Date.now() - stored.at < TTL && !excluded.has(stored.track.videoId)) return json(stored.track);
  try {
    // Consulta por ARTISTA do gênero; nunca pelo texto do nome do gênero.
    // Duas tentativas no máximo para controlar a cota da YouTube Data API.
    for (const artist of randomizedArtists(GENRE_ARTISTS[genre]).slice(0, 2)) {
      const result = await searchArtist(artist, excluded, key);
      if (!result) continue;
      const track = {
        title: result.title,
        artist: result.artist,
        videoId: result.videoId,
        duration: result.duration,
        matchedArtist: artist,
        matchMethod: "genre-artist",
      };
      cache.set(genre, { at: Date.now(), track });
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
      return json(track);
    }
    return json({ error: "Não foi encontrada uma faixa confiável. Sorteie outro gênero." }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro temporário no YouTube." }, 502);
  }
}
