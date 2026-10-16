import { GENRE_ARTISTS } from "./genre-artists.mjs";

// Netlify Functions v2. Apenas publica nomes de gêneros, nunca a chave.
export default async function handler() {
  return new Response(JSON.stringify({
    youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY),
    playableGenres: Object.keys(GENRE_ARTISTS),
    selectionMethod: "verified-artist-first",
  }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
