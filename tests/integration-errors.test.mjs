import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/search.mjs";
import { resolveGenreArtists } from "../netlify/functions/every-noise-artists.mjs";

test("cota esgotada: um único search e erro explícito, sem repetir buscas", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.YOUTUBE_API_KEY;
  let searches = 0;
  try {
    process.env.YOUTUBE_API_KEY = "test-only";
    globalThis.fetch = async (url) => {
      if (String(url).includes("/youtube/v3/search")) searches += 1;
      return new Response(JSON.stringify({ error: { errors: [{ reason: "quotaExceeded" }] } }),
        { status: 403, headers: { "content-type": "application/json" } });
    };
    const response = await handler(new Request("https://site.example/api/search?genre=fijian%20pop"));
    const body = await response.json();
    assert.equal(response.status, 429);
    assert.equal(body.code, "YOUTUBE_QUOTA");
    assert.equal(searches, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = oldKey;
  }
});

test("consulta autor e mirror quando o primeiro HTML não está disponível", async () => {
  const oldFetch = globalThis.fetch;
  const called = [];
  try {
    globalThis.fetch = async (url) => {
      called.push(String(url));
      if (String(url).includes("www.furia.com")) {
        return new Response('<div class="genre scanme">Example Mirror Artist »</div>', {
          status: 200, headers: { "content-type": "text/html" },
        });
      }
      return new Response("Not found", { status: 404, headers: { "content-type": "text/html" } });
    };
    const result = await resolveGenreArtists("test genre with mirror");
    assert.equal(result.source, "author-archive");
    assert.deepEqual(result.artists, ["Example Mirror Artist"]);
    assert.equal(called.length, 2);
  } finally { globalThis.fetch = oldFetch; }
});
