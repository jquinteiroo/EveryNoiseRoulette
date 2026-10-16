"use strict";

// IDs de vídeos públicos selecionados manualmente para a demonstração.
// A incorporação pode mudar conforme direitos, região e preferências dos titulares.
const DEMO_TRACKS = [
  { genre: "disco house", title: "One More Time", artist: "Daft Punk", videoId: "FGBhQbmPwH8", duration: 320 },
  { genre: "neo-psychedelic", title: "The Less I Know The Better", artist: "Tame Impala", videoId: "sBzrzS1Ag_g", duration: 216 },
  { genre: "big beat", title: "Galvanize", artist: "The Chemical Brothers", videoId: "Xu3FTEmN-eg", duration: 238 },
  { genre: "reggae", title: "Three Little Birds", artist: "Bob Marley & The Wailers", videoId: "HNBCVM4KbUM", duration: 194 },
  { genre: "belgian dance", title: "Alors on danse", artist: "Stromae", videoId: "J9yzoTHP9HY", duration: 233 },
  { genre: "latin alternative", title: "Soy Yo", artist: "Bomba Estéreo", videoId: "bxWxXncl53U", duration: 174 },
];

const STORAGE_KEY = "every-noise-roulette-v1";
const TRACK_CACHE_VERSION = 3; // invalida escolhas antigas baseadas só no nome do gênero
const MAX_HISTORY = 24;
const $ = (id) => document.getElementById(id);
const ui = {
  genre: $("genre-title"), title: $("track-title"), artist: $("track-artist"),
  mode: $("mode-pill"), status: $("feedback"), playState: $("play-state"),
  playingDot: $("playing-dot"), spin: $("spin-button"), spinLabel: $("spin-label"),
  back: $("back-button"), restart: $("restart-button"), favorite: $("favorite-button"),
  favIcon: $("favorite-icon"), youtube: $("youtube-link"), video: $("video-frame"),
  report: $("report-button"),
  total: $("total-genres"), discoveries: $("discovery-count"),
  history: $("history-list"), favorites: $("favorites-list"), note: $("catalog-note"),
};

function storedState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      history: parsed.cacheVersion === TRACK_CACHE_VERSION && Array.isArray(parsed.history) ? parsed.history.filter(isValidTrack).slice(-MAX_HISTORY) : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter(isValidTrack).slice(0, 100) : [],
      discoveries: Number.isSafeInteger(parsed.discoveries) && parsed.discoveries >= 0 ? parsed.discoveries : 0,
      cache: parsed.cacheVersion === TRACK_CACHE_VERSION && parsed.cache && typeof parsed.cache === "object" && !Array.isArray(parsed.cache) ? parsed.cache : {},
      blockedVideos: Array.isArray(parsed.blockedVideos) ? parsed.blockedVideos.filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id)).slice(-20) : [],
    };
  } catch (_) { return { history: [], favorites: [], discoveries: 0, cache: {}, blockedVideos: [] }; }
}
function isValidTrack(track) {
  return track && typeof track.genre === "string" && typeof track.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(track.videoId);
}
const saved = storedState();
let genres = DEMO_TRACKS.map((track) => track.genre);
let catalogSize = 5925; // Atualizado com a quantidade real no arquivo local.
let manuallyCuratedCount = 63;
const failedGenres = new Set();
let apiEnabled = false;
let history = saved.history;
let cursor = history.length - 1;
let favorites = saved.favorites;
let discoveries = saved.discoveries;
let videoCache = saved.cache;
let blockedVideos = saved.blockedVideos;
let current = null;
let player = null;
let playerReady = false;
let requestedTrack = null;
let busy = false;

function persist() {
  try {
    // Evita saturar o armazenamento quando muitos gêneros já foram visitados.
    const entries = Object.entries(videoCache).slice(-125);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      history, favorites, discoveries, cache: Object.fromEntries(entries),
      cacheVersion: TRACK_CACHE_VERSION, blockedVideos,
    }));
  } catch (_) { /* O modo privado pode desativar armazenamento. */ }
}
function say(message) { ui.status.textContent = message; }
function formatNumber(n) { return new Intl.NumberFormat("pt-BR").format(n); }
function updateCounts() {
  ui.total.textContent = formatNumber(apiEnabled ? genres.length : DEMO_TRACKS.length);
  ui.discoveries.textContent = String(discoveries).padStart(2, "0");
}
function updateMode() {
  ui.mode.textContent = apiEnabled ? "TODOS OS GÊNEROS" : "MODO DEMONSTRAÇÃO";
  ui.note.textContent = apiEnabled
    ? "Todos os " + formatNumber(genres.length) + " gêneros participam do sorteio. " +
      formatNumber(manuallyCuratedCount) + " têm artistas mapeados localmente; para os demais o site tenta identificar artistas nas páginas do Every Noise. " +
      "Quando não encontra uma associação confiável, tenta outro gênero. Nem toda música do artista necessariamente pertence ao estilo sorteado."
    : "Sem integração ativa com a API do YouTube, o player usa seis faixas demonstrativas. No Netlify, configure YOUTUBE_API_KEY para sortear o catálogo inteiro.";
  updateCounts();
}
function chooseRandom(items, avoid = []) {
  const excluded = new Set(avoid.map((name) => String(name).toLowerCase()));
  const candidates = items.filter((x) => !excluded.has(String(typeof x === "string" ? x : x.genre).toLowerCase()));
  const pool = candidates.length ? candidates : items;
  if (!pool.length) return null;
  const values = new Uint32Array(1);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(values);
  else values[0] = Math.floor(Math.random() * 0xffffffff);
  return pool[values[0] % pool.length];
}
function startAt(track) {
  const seconds = Number(track.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) return 60;
  // 40% da música, com pelo menos 20 segundos restantes.
  return Math.max(0, Math.min(Math.round(seconds * 0.4), Math.floor(seconds - 20)));
}

function renderList(container, tracks, placeholder) {
  container.replaceChildren();
  if (!tracks.length) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = placeholder;
    container.append(p);
    return;
  }
  tracks.forEach((track) => {
    const button = document.createElement("button");
    button.type = "button";
    button.title = "Reproduzir " + track.genre;
    const label = document.createElement("span");
    const main = document.createElement("strong");
    main.textContent = track.genre;
    const sub = document.createElement("small");
    sub.textContent = [track.artist, track.title].filter(Boolean).join(" · ") || "Explorar gênero";
    const arrow = document.createElement("span");
    arrow.className = "trail";
    arrow.textContent = "↗";
    label.append(main, sub);
    button.append(label, arrow);
    button.addEventListener("click", () => {
      if (busy) return;
      // A seleção na lista vira uma nova entrada do histórico.
      setTrack(track, true);
      say("Descoberta recuperada. Aproveite a música!");
    });
    container.append(button);
  });
}
function renderLists() {
  renderList(ui.history, [...history].reverse().slice(0, 4), "Suas descobertas vão aparecer aqui depois do primeiro sorteio.");
  renderList(ui.favorites, favorites.slice(0, 4), "Curtiu um gênero? Toque em Favoritar e guarde essa descoberta.");
}
function updateFavorite() {
  const selected = !!current && favorites.some((t) => t.genre === current.genre);
  ui.favorite.disabled = !current;
  ui.favorite.setAttribute("aria-pressed", String(selected));
  ui.favIcon.textContent = selected ? "♥" : "♡";
  ui.favorite.lastChild.textContent = selected ? " Favoritado" : " Favoritar";
}
function updateControls() {
  ui.back.disabled = cursor <= 0 || busy;
  ui.report.disabled = !current || busy;
  ui.restart.disabled = !current;
  ui.youtube.setAttribute("aria-disabled", String(!current));
  ui.youtube.href = current ? "https://www.youtube.com/watch?v=" + current.videoId : "https://www.youtube.com/";
  ui.youtube.style.pointerEvents = current ? "auto" : "none";
  updateFavorite();
}
function stopPlayback() {
  if (playerReady && player && typeof player.stopVideo === "function") {
    try { player.stopVideo(); } catch (_) { /* Player indisponível. */ }
  }
  ui.playingDot.classList.remove("active");
  ui.playState.textContent = "CARREGANDO FAIXA";
}
function playTrack(track) {
  requestedTrack = track;
  if (playerReady && player) {
    try {
      ui.video.classList.add("has-video");
      player.loadVideoById({ videoId: track.videoId, startSeconds: startAt(track) });
      ui.playState.textContent = "CARREGANDO FAIXA";
      say("O vídeo vai começar perto do meio da música. Se o navegador bloquear, toque ▶ no player.");
    } catch (_) {
      say("Não foi possível iniciar o player. Abra o vídeo pelo link do YouTube.");
    }
  } else {
    say("Carregando player do YouTube... Caso demore, confira a conexão.");
    if (window.YT && typeof window.YT.Player === "function") setupYouTube();
  }
}
function setTrack(track, addHistory = true) {
  if (!isValidTrack(track)) return;
  stopPlayback();
  current = { genre: track.genre, title: track.title || "Música encontrada", artist: track.artist || "", videoId: track.videoId, duration: Number(track.duration) || 0 };
  ui.genre.textContent = current.genre;
  ui.genre.classList.remove("switching");
  void ui.genre.offsetWidth;
  ui.genre.classList.add("switching");
  ui.title.textContent = current.title;
  ui.artist.textContent = current.artist;
  ui.spinLabel.textContent = "SORTear OUTRO GÊNERO".toUpperCase();
  if (addHistory) {
    history = history.slice(0, cursor + 1);
    history.push(current);
    history = history.slice(-MAX_HISTORY);
    cursor = history.length - 1;
    discoveries += 1;
  }
  updateCounts();
  renderLists();
  updateControls();
  persist();
  playTrack(current);
}
function setBusy(value) {
  busy = value;
  ui.spin.disabled = value;
  ui.spinLabel.textContent = value ? "PROCURANDO UMA FAIXA..." : current ? "SORTEAR OUTRO GÊNERO" : "SORTEAR UM GÊNERO";
  updateControls();
}
async function findGenreVideo(genre) {
  const cached = videoCache[genre];
  if (isValidTrack(cached) && !blockedVideos.includes(cached.videoId)) return cached;
  const params = new URLSearchParams({ genre });
  if (blockedVideos.length) params.set("exclude", blockedVideos.join(","));
  const res = await fetch("/api/search?" + params.toString(), { headers: { Accept: "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 503) throw new Error("API não configurada");
    throw new Error(json.error || "Não encontramos vídeo para esse gênero.");
  }
  const track = { genre, title: json.title, artist: json.artist, videoId: json.videoId, duration: json.duration };
  if (!isValidTrack(track) || json.matchMethod !== "genre-artist") throw new Error("Resposta sem validação do artista.");
  videoCache[genre] = track;
  persist();
  return track;
}
async function spin() {
  if (busy) return;
  setBusy(true);
  try {
    const recent = [...history.slice(-7).map((t) => t.genre), ...failedGenres];
    if (!apiEnabled) {
      const availableDemos = DEMO_TRACKS.filter((track) => !blockedVideos.includes(track.videoId));
      const demo = chooseRandom(availableDemos, recent);
      if (!demo) { say("Não restaram músicas na demonstração. Configure a API do YouTube para continuar."); return; }
      setTrack(demo, true);
      return;
    }
    const tested = [...recent];
    for (let attempt = 0; attempt < 4; attempt++) {
      const genre = chooseRandom(genres, tested);
      if (!genre) break;
      tested.push(genre);
      say("Buscando uma música para “" + genre + "”...");
      try {
        const result = await findGenreVideo(genre);
        setTrack(result, true);
        return;
      } catch (err) {
        if (!String(err.message).includes("não configurada")) failedGenres.add(genre);
        if (failedGenres.size > 200) failedGenres.delete(failedGenres.values().next().value);
        if (String(err.message).includes("não configurada")) {
          apiEnabled = false;
          updateMode();
          break;
        }
      }
    }
    say("Não encontramos uma faixa com associação confiável nesses sorteios. Clique novamente para explorar outros gêneros.");
  } catch (_) {
    say("Ocorreu um erro ao sortear. Tente novamente.");
  } finally { setBusy(false); }
}
function toggleFavorite() {
  if (!current) return;
  const idx = favorites.findIndex((t) => t.genre === current.genre);
  if (idx === -1) { favorites.unshift(current); say("Gênero salvo nos seus favoritos!"); }
  else { favorites.splice(idx, 1); say("Gênero retirado dos favoritos."); }
  renderLists();
  updateFavorite();
  persist();
}
async function reportNonMusic() {
  if (!current || busy) return;
  const rejected = current;
  blockedVideos = [...new Set([...blockedVideos, rejected.videoId])].slice(-20);
  for (const [genre, track] of Object.entries(videoCache)) {
    if (track && track.videoId === rejected.videoId) delete videoCache[genre];
  }
  favorites = favorites.filter((track) => track.videoId !== rejected.videoId);
  history = history.filter((track) => track.videoId !== rejected.videoId);
  cursor = history.length - 1;
  current = null;
  requestedTrack = null;
  stopPlayback();
  ui.video.classList.remove("has-video");
  ui.genre.textContent = rejected.genre;
  ui.title.textContent = "Procurando outra música...";
  ui.artist.textContent = "";
  renderLists();
  updateControls();
  persist();
  // O bloqueio é local ao navegador; o servidor recebe IDs a excluir.
  if (!apiEnabled) {
    say("Vídeo marcado como inadequado. Sorteando outro gênero...");
    await spin();
    return;
  }
  setBusy(true);
  let found = false;
  try {
    say("Esse vídeo não será mostrado novamente neste navegador. Procurando outra faixa para “" + rejected.genre + "”...");
    const replacement = await findGenreVideo(rejected.genre);
    if (blockedVideos.includes(replacement.videoId)) throw new Error("Vídeo rejeitado");
    setTrack(replacement, true);
    found = true;
    say("Outra faixa selecionada. Obrigado por sinalizar o vídeo!");
  } catch (_) {
    say("Nenhuma alternativa segura encontrada nesse gênero. Tentando outro...");
  } finally {
    setBusy(false);
  }
  if (!found) await spin();
}
function previous() {
  if (cursor < 1 || busy) return;
  cursor -= 1;
  setTrack(history[cursor], false);
  say("Voltando para sua descoberta anterior.");
}
function restart() {
  if (!current) return;
  if (playerReady && player) {
    try { player.seekTo(0, true); player.playVideo(); say("Reproduzindo desde o início."); }
    catch (_) { say("Use a barra de progresso do vídeo para voltar ao início."); }
  } else say("Aguarde o carregamento do player.");
}

function setupYouTube() {
  if (player || !window.YT || typeof window.YT.Player !== "function") return;
  player = new window.YT.Player("youtube-player", {
    width: "100%", height: "100%",
    playerVars: { controls: 1, playsinline: 1, rel: 0, origin: location.origin.startsWith("http") ? location.origin : undefined },
    events: {
      onReady: () => {
        playerReady = true;
        if (requestedTrack) playTrack(requestedTrack);
      },
      onStateChange: (event) => {
        if (!window.YT) return;
        const state = event.data;
        ui.playingDot.classList.toggle("active", state === YT.PlayerState.PLAYING);
        const message = state === YT.PlayerState.PLAYING ? "TOCANDO AGORA"
          : state === YT.PlayerState.PAUSED ? "PAUSADO"
          : state === YT.PlayerState.ENDED ? "FAIXA FINALIZADA"
          : "PRONTO PARA OUVIR";
        ui.playState.textContent = message;
        if (state === YT.PlayerState.PLAYING) say("Escute até o fim ou clique em Sortear outro gênero.");
        if (state === YT.PlayerState.ENDED) say("Essa terminou! Clique em Sortear outro gênero para continuar.");
      },
      onError: (event) => {
        ui.playingDot.classList.remove("active");
        ui.playState.textContent = "VÍDEO INDISPONÍVEL";
        say("O YouTube não permite reproduzir este vídeo aqui (erro " + event.data + "). Clique em Ver no YouTube ou sorteie outra música.");
      },
      onAutoplayBlocked: () => say("O navegador bloqueou a reprodução automática. Aperte ▶ no próprio player do YouTube."),
    },
  });
}
window.onYouTubeIframeAPIReady = setupYouTube;

async function initialize() {
  updateCounts();
  updateMode();
  renderLists();
  updateControls();
  ui.spin.addEventListener("click", spin);
  ui.back.addEventListener("click", previous);
  ui.restart.addEventListener("click", restart);
  ui.favorite.addEventListener("click", toggleFavorite);
  ui.report.addEventListener("click", reportNonMusic);
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.target.closest("button, a, input, textarea, select")) return;
    if (event.key.toLowerCase() === "n") { event.preventDefault(); spin(); }
  });
  if (window.YT && typeof window.YT.Player === "function") setupYouTube();
  try {
    const result = await fetch("./data/genres.json");
    if (!result.ok) throw new Error("Catálogo inacessível");
    const catalog = await result.json();
    if (Array.isArray(catalog.genres) && catalog.genres.length > 1000) {
      genres = catalog.genres.filter((genre) => typeof genre === "string" && genre.length < 90);
      catalogSize = genres.length;
    }
  } catch (_) {
    say("Não foi possível carregar todos os gêneros. O modo demonstrativo segue disponível.");
  }
  updateCounts();
  try {
    const response = await fetch("/api/status", { headers: { Accept: "application/json" } });
    if (response.ok) {
      const info = await response.json();
      apiEnabled = info.youtubeConfigured === true && genres.length > 1000;
      if (Array.isArray(info.playableGenres)) manuallyCuratedCount = info.playableGenres.length;
    }
  } catch (_) { /* Sem backend: roda com os exemplos selecionados. */ }
  updateMode();
  say(apiEnabled
    ? "Tudo pronto! Os gêneros do catálogo inteiro podem ser sorteados. A disponibilidade de música depende da validação dos artistas."
    : "Tudo pronto! Experimente a versão demonstrativa com seis músicas.");
}
initialize();
