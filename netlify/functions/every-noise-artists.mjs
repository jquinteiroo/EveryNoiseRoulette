// Consulta pontual à página pública de artistas por gênero do Every Noise.
// Sem contornar restrições: em caso de bloqueio, erro ou HTML incompatível,
// devolve [] e deixa o sorteio tentar outro gênero.
const artistCache = new Map();
const OK_TTL = 24 * 60 * 60 * 1000;
const ERROR_TTL = 5 * 60 * 1000;
const MAX_CACHE = 400;

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi, (entity) => ({
      "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&apos;": "'",
      "&lt;": "<", "&gt;": ">"
    }[entity.toLowerCase()] || ""))
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, raw) => {
      const value = raw.toLowerCase().startsWith("x")
        ? parseInt(raw.slice(1), 16) : parseInt(raw, 10);
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff
        ? String.fromCodePoint(value) : "";
    })
    .replace(/»|↗/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function parseArtistsFromGenrePage(html) {
  if (typeof html !== "string") return [];
  const found = [];
  // Divs de artistas nas páginas engenremap-...html possuem 'genre scanme'.
  // Em páginas mais antigas, a ordem dos atributos pode variar.
  const tag = /<div\b([^>]*)>([\s\S]*?)<\/div\s*>/gi;
  let match;
  while ((match = tag.exec(html)) !== null && found.length < 40) {
    const attr = match[1];
    const cls = /\bclass\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(attr);
    const classes = (cls?.[1] || cls?.[2] || cls?.[3] || "").split(/\s+/);
    if (!(classes.includes("genre") && classes.includes("scanme"))) continue;
    const rawName = cleanText(match[2]);
    if (!rawName || rawName.length < 2 || rawName.length > 90 ||
        /^(scan|playlist|pulse|edge|genres|artists?)$/i.test(rawName) ||
        found.some((s) => s.toLowerCase() === rawName.toLowerCase())) continue;
    found.push(rawName);
  }
  return found;
}
export function everyNoisePageForGenre(genre) {
  const slug = String(genre || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!slug || slug.length > 100) return null;
  return "https://everynoise.com/engenremap-" + slug + ".html";
}
export async function getGenreArtistsFromEveryNoise(genre) {
  const now = Date.now();
  const cached = artistCache.get(genre);
  if (cached && now - cached.at < (cached.artists.length ? OK_TTL : ERROR_TTL)) return cached.artists;
  const url = everyNoisePageForGenre(genre);
  if (!url) return [];
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "text/html" },
      redirect: "error",
    });
    if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) return [];
    const html = await response.text();
    if (html.length > 3_000_000) return [];
    const artists = parseArtistsFromGenrePage(html);
    artistCache.set(genre, { at: now, artists });
    if (artistCache.size > MAX_CACHE) artistCache.delete(artistCache.keys().next().value);
    return artists;
  } catch (_) {
    artistCache.set(genre, { at: now, artists: [] });
    if (artistCache.size > MAX_CACHE) artistCache.delete(artistCache.keys().next().value);
    return [];
  }
}
