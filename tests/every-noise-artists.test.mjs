import test from "node:test";
import assert from "node:assert/strict";
import {
  parseArtistsFromGenrePage,
  everyNoisePageForGenre,
} from "../netlify/functions/every-noise-artists.mjs";

test("parseia artistas no HTML do mapa individual do Every Noise", () => {
  const html = [
    '<div class="genre scanme" id="item0">Kacey Musgraves <a href="abc">»</a></div>',
    '<div class="genre scanme" style="color: blue">LeAnn Rimes</div>',
    '<div class="genre" id="similar">country dawn</div>',
  ].join("");
  assert.deepEqual(parseArtistsFromGenrePage(html), ["Kacey Musgraves", "LeAnn Rimes"]);
});

test("decodifica entidades, deduplica e evita campos não musicais", () => {
  const html = [
    '<div class="genre scanme">Laisa &amp; friends »</div>',
    '<div class="genre scanme">Laisa &amp; friends</div>',
    '<div class="genre scanme">scan</div>',
    '<div class="genre other">Nota sobre música</div>',
  ].join("");
  assert.deepEqual(parseArtistsFromGenrePage(html), ["Laisa & friends"]);
});

test("endereço da página é formado apenas com slug", () => {
  assert.equal(everyNoisePageForGenre("fijian pop"),
    "https://everynoise.com/engenremap-fijianpop.html");
  assert.equal(everyNoisePageForGenre("country dawn"),
    "https://everynoise.com/engenremap-countrydawn.html");
  assert.equal(everyNoisePageForGenre("***"), null);
});

test("HTML inválido ou indisponível não produz artistas inventados", () => {
  assert.deepEqual(parseArtistsFromGenrePage("<html><body>Page not found</body></html>"), []);
  assert.deepEqual(parseArtistsFromGenrePage(null), []);
});
