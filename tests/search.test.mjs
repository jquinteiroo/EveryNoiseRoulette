import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMusicVideo } from "../netlify/functions/search.mjs";
import { GENRE_ARTISTS } from "../netlify/functions/genre-artists.mjs";

function video({ title, channel = "Canal", description = "", categoryId = "10",
  embeddable = true, privacyStatus = "public", duration = "PT4M20S" } = {}) {
  return {
    id: "abcdefghijk",
    snippet: { title, channelTitle: channel, description, categoryId, liveBroadcastContent: "none" },
    status: { embeddable, privacyStatus },
    contentDetails: { duration },
  };
}

test("regressão: Fiji (reggae) não é aceito como Simi Rova (fijian pop)", () => {
  const wrong = video({ title: "Fiji - Sweet Darlin' (Official Lyric Video)", channel: "Fiji" });
  assert.equal(evaluateMusicVideo(wrong, "Simi Rova"), null);
  assert.ok(!GENRE_ARTISTS["fijian pop"].includes("Fiji"));
});

test("regressão: Country Dawn - Release - Topic não é Kacey Musgraves", () => {
  const wrong = video({ title: "Country Dawn", channel: "Release - Topic", description: "Provided to YouTube by ..." });
  assert.equal(evaluateMusicVideo(wrong, "Kacey Musgraves"), null);
});

test("canal Topic de artista mapeado passa", () => {
  const good = video({ title: "Space Cowboy", channel: "Kacey Musgraves - Topic", description: "Provided to YouTube by label" });
  assert.equal(evaluateMusicVideo(good, "Kacey Musgraves")?.artist, "Kacey Musgraves");
});

test("canal oficial / crédito de título com áudio oficial passam", () => {
  const good = video({ title: "The Killers - Mr. Brightside (Official Music Video)", channel: "TheKillersVEVO" });
  assert.equal(evaluateMusicVideo(good, "The Killers")?.videoId, "abcdefghijk");
});

test("não aceita vídeo de colecionador mesmo contendo artista no título", () => {
  const wrong = video({ title: "Kacey Musgraves - Vinyl Record Collection Gems", channel: "Kacey Musgraves - Topic" });
  assert.equal(evaluateMusicVideo(wrong, "Kacey Musgraves"), null);
});

test("categoria não musical, privado e não incorporável são recusados", () => {
  const base = { title: "Kacey Musgraves - Slow Burn (Official Audio)", channel: "Kacey Musgraves" };
  assert.equal(evaluateMusicVideo(video({ ...base, categoryId: "22" }), "Kacey Musgraves"), null);
  assert.equal(evaluateMusicVideo(video({ ...base, embeddable: false }), "Kacey Musgraves"), null);
  assert.equal(evaluateMusicVideo(video({ ...base, privacyStatus: "private" }), "Kacey Musgraves"), null);
});

test("não aceita coletâneas e vídeos longos", () => {
  const wrong = video({ title: "Kacey Musgraves - Song (Official Audio)", channel: "Kacey Musgraves", duration: "PT1H12M" });
  assert.equal(evaluateMusicVideo(wrong, "Kacey Musgraves"), null);
});

test("a curadoria contém artistas de ambos os gêneros problemáticos", () => {
  assert.ok(GENRE_ARTISTS["fijian pop"].includes("Simi Rova"));
  assert.ok(GENRE_ARTISTS["country dawn"].includes("LeAnn Rimes"));
});
