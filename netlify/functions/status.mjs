// Netlify Functions v2. A chave permanece apenas no servidor.
export default async function handler() {
  return new Response(JSON.stringify({ youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY) }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
