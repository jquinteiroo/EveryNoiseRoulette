import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMusicVideo } from "../netlify/functions/search.mjs";

function video({
  title, channel = "Canal", description = "", categoryId = "10",
  embeddable = true, privacyStatus = "public", duration = "PT4M20S",
} = {}) {
  return {
    id: "abcdefghijk",
    snippet: { title, channelTitle: channel, description, categoryId, liveBroadcastContent: "none" },
    status: { embeddable, privacyStatus },
    contentDetails: { duration },
  };
}

test("regressão: US Power Metal Gems é conteúdo sobre discos, não uma faixa", () => {
  assert.equal(evaluateMusicVideo(video({
    title: "US Power Metal Gems 💎",
    channel: "Vampire Choir",
    description: "Official music video and metal records",
  }), "us power metal"), null);
});

test("aceita uma faixa enviada para canal Topic", () => {
  const picked = evaluateMusicVideo(video({
    title: "Through the Fire and Flames",
    channel: "DragonForce - Topic",
    description: "Provided to YouTube by a music distributor",
  }), "power metal");
  assert.equal(picked.videoId, "abcdefghijk");
});

test("aceita videoclipe oficial", () => {
  const picked = evaluateMusicVideo(video({
    title: "The Killers - Mr. Brightside (Official Music Video)",
    channel: "TheKillersVEVO",
  }), "indie rock");
  assert.ok(picked);
});

test("rejeita entrevistas e comentários mesmo na categoria Música", () => {
  assert.equal(evaluateMusicVideo(video({
    title: "Power Metal - music review",
    channel: "MetalFan",
    description: "Official audio included",
  }), "power metal"), null);
});

test("rejeita vídeo sem evidência de lançamento musical", () => {
  assert.equal(evaluateMusicVideo(video({
    title: "US Power Metal Gems",
    channel: "Vampire Choir",
  }), "us power metal"), null);
});

test("rejeita outras categorias e vídeos não incorporáveis", () => {
  assert.equal(evaluateMusicVideo(video({
    title: "Band - Song (Official Audio)", categoryId: "22",
  }), "rock"), null);
  assert.equal(evaluateMusicVideo(video({
    title: "Band - Song (Official Audio)", embeddable: false,
  }), "rock"), null);
});

test("rejeita durações longas, típicas de coletâneas", () => {
  assert.equal(evaluateMusicVideo(video({
    title: "Band - Song (Official Audio)", duration: "PT1H10M",
  }), "rock"), null);
});
