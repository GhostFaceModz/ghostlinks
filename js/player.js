/** YouTube iframe player with a custom control row. Songs that refuse
    embedding are skipped. The API script is loaded once per page. */

import { svgIcon } from "./icons.js";

let apiPromise = null;
let sequence = 0;

function loadApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve();
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube could not load"));
      document.head.append(script);
    });
  }
  return apiPromise;
}

function timeLabel(value) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

function paintRange(input, percent) {
  input.style.setProperty("--progress", `${Math.max(0, Math.min(100, percent))}%`);
}

function cleanTitle(title) {
  if (!title) return "";
  return String(title).split(" | ")[0].replace(/\s*[([（](official|lyric|audio|music video|visualizer)[^)\]]*[\])）]/ig, "").trim();
}

function readVolume() {
  try {
    const stored = localStorage.getItem("ghostlinks.volume");
    if (stored == null || stored === "") return 30;
    const value = Number(stored);
    if (Number.isFinite(value)) return Math.max(0, Math.min(100, value));
  } catch { /* private mode */ }
  return 30;
}

function storeVolume(value) {
  try { localStorage.setItem("ghostlinks.volume", String(value)); } catch { /* ignore */ }
}

export function bindPlayer(root, initialTracks) {
  const slot = root.querySelector(".yt-slot");
  const playButton = root.querySelector(".play");
  const title = root.querySelector(".track-title");
  const byline = root.querySelector(".track-by");
  const state = root.querySelector(".now");
  const cover = root.querySelector(".cover");
  const count = root.querySelector(".track-count");
  const elapsed = root.querySelector(".elapsed");
  const duration = root.querySelector(".duration");
  const seek = root.querySelector(".seek");
  const volume = root.querySelector(".volume");
  const mute = root.querySelector(".mute");
  const open = root.querySelector(".yt-open");
  let tracks = initialTracks.slice();
  let index = 0;
  let player = null;
  let ready = false;
  let playing = false;
  let wantPlay = false;
  let muted = false;
  let level = readVolume();
  let failures = 0;
  let seeking = false;
  let poll = 0;
  let destroyed = false;
  const slotId = `yt-slot-${++sequence}`;
  slot.id = slotId;

  volume.value = String(level);
  paintRange(volume, level);

  function current() {
    return tracks[index] || null;
  }

  function setState(text) {
    state.textContent = text;
  }

  function showMeta() {
    const track = current();
    const data = player && ready && player.getVideoData ? player.getVideoData() || {} : {};
    const id = (data.video_id || track?.id || "");
    const label = cleanTitle(data.title) || track?.title || "YouTube music";
    title.textContent = label;
    title.classList.toggle("overflowing", label.length > 28);
    byline.textContent = data.author || track?.artist || "YouTube";
    count.textContent = tracks.length ? `${index + 1} / ${tracks.length}` : "";
    if (id) {
      open.href = `https://www.youtube.com/watch?v=${id}`;
      if (showArt) {
        cover.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        cover.alt = "";
      }
    }
  }

  function applyVolume() {
    if (!player || !ready) return;
    player.setVolume(level);
    if (muted || level === 0) player.mute();
    else player.unMute();
  }

  function syncMute() {
    const silent = muted || level === 0;
    mute.setAttribute("aria-pressed", String(silent));
    mute.setAttribute("aria-label", silent ? "Unmute" : "Mute");
    mute.replaceChildren();
    mute.append(icon(silent ? "muted" : "sound"));
    paintRange(volume, silent ? 0 : level);
  }

  function syncPlay() {
    root.classList.toggle("is-playing", playing);
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
    playButton.replaceChildren();
    playButton.append(icon(playing ? "pause" : "play"));
    setState(playing ? "Now playing" : "Paused");
  }

  function tick() {
    if (!player || !ready || seeking) return;
    const at = Number(player.getCurrentTime()) || 0;
    const total = Number(player.getDuration()) || 0;
    elapsed.textContent = timeLabel(at);
    duration.textContent = timeLabel(total);
    const percent = total > 0 ? (at / total) * 100 : 0;
    seek.value = String(percent);
    seek.setAttribute("aria-valuetext", `${timeLabel(at)} of ${timeLabel(total)}`);
    paintRange(seek, percent);
  }

  function watch(on) {
    clearInterval(poll);
    poll = on ? window.setInterval(tick, 250) : 0;
  }

  function load(nextIndex, autoplay) {
    if (!tracks.length) return;
    index = (nextIndex + tracks.length) % tracks.length;
    showMeta();
    if (!player || !ready) return;
    const id = tracks[index].id;
    if (autoplay) player.loadVideoById(id);
    else player.cueVideoById(id);
  }

  let armed = false;
  let showArt = false;
  function play() {
    wantPlay = true;
    if (!tracks.length) return;
    if (!armed) {
      setState("Ready when you enter");
      return;
    }
    if (!player || !ready) {
      setState("Loading…");
      ensure();
      return;
    }
    applyVolume();
    player.playVideo();
  }

  function pause() {
    wantPlay = false;
    if (player && ready) player.pauseVideo();
  }

  function onReady() {
    if (destroyed) return;
    ready = true;
    applyVolume();
    if (tracks[index]) player.cueVideoById(tracks[index].id);
    showMeta();
    syncMute();
    if (wantPlay) play();
  }

  function onState(event) {
    const codes = window.YT?.PlayerState || { ENDED: 0, PLAYING: 1, PAUSED: 2, CUED: 5 };
    if (event.data === codes.PLAYING) {
      playing = true;
      failures = 0;
      watch(true);
    } else if (event.data === codes.PAUSED || event.data === codes.CUED) {
      playing = false;
      watch(false);
    } else if (event.data === codes.ENDED) {
      playing = false;
      watch(false);
      load(index + 1, true);
    }
    showMeta();
    syncPlay();
    tick();
  }

  function onError() {
    failures += 1;
    if (failures >= Math.max(tracks.length, 1)) {
      playing = false;
      syncPlay();
      setState("These tracks can't be embedded");
      return;
    }
    setState("Skipping a track that can't play here");
    load(index + 1, wantPlay);
  }

  function ensure() {
    if (player || destroyed || !tracks.length) return;
    loadApi().then(() => {
      if (destroyed || player || !window.YT?.Player) return;
      const origin = /^https?:/.test(location.protocol) ? location.origin : undefined;
      const vars = { autoplay: 0, controls: 0, disablekb: 1, fs: 0, host: "https://www.youtube-nocookie.com", modestbranding: 1, playsinline: 1, rel: 0, iv_load_policy: 3 };
      if (origin) vars.origin = origin;
      player = new window.YT.Player(slotId, {
        width: 200,
        height: 200,
        videoId: tracks[index] ? tracks[index].id : undefined,
        playerVars: vars,
        events: { onReady, onStateChange: onState, onError }
      });
    }).catch(() => setState("YouTube couldn't load"));
  }

  function icon(name) {
    return svgIcon(name);
  }

  playButton.addEventListener("click", () => (playing ? pause() : play()));
  root.querySelector(".prev").addEventListener("click", () => {
    if (player && ready && Number(player.getCurrentTime()) > 3) {
      player.seekTo(0, true);
      return;
    }
    load(index - 1, wantPlay || playing);
  });
  root.querySelector(".next").addEventListener("click", () => load(index + 1, wantPlay || playing));
  mute.addEventListener("click", () => {
    if (level === 0) {
      level = 30;
      muted = false;
    } else muted = !muted;
    volume.value = String(muted ? 0 : level);
    applyVolume();
    syncMute();
  });
  volume.addEventListener("input", () => {
    level = Number(volume.value);
    muted = false;
    storeVolume(level);
    applyVolume();
    syncMute();
  });
  seek.addEventListener("input", () => {
    seeking = true;
    const total = player && ready ? Number(player.getDuration()) : 0;
    const percent = Number(seek.value);
    paintRange(seek, percent);
    if (total > 0) elapsed.textContent = timeLabel((percent / 100) * total);
  });
  seek.addEventListener("change", () => {
    seeking = false;
    const total = player && ready ? Number(player.getDuration()) : 0;
    if (total > 0 && player) player.seekTo((Number(seek.value) / 100) * total, true);
    tick();
  });

  showMeta();
  syncPlay();
  syncMute();
  setState(tracks.length ? "Ready when you enter" : "No tracks yet");

  return {
    play,
    activate() {
      armed = true;
      showArt = true;
      showMeta();
      wantPlay = true;
      if (!tracks.length) return;
      ensure();
      if (ready) play();
    },
    revealArt() {
      showArt = true;
      showMeta();
    },
    pause() { pause(); },
    toggleMute() {
      muted = !muted;
      if (!muted && level === 0) level = 30;
      volume.value = String(muted ? 0 : level);
      applyVolume();
      syncMute();
      return muted || level === 0;
    },
    setTracks(next) {
      tracks = next.slice();
      if (!tracks.length) {
        pause();
        showMeta();
        setState("No tracks yet");
        return;
      }
      if (!tracks[index]) index = 0;
      showMeta();
      if (armed) ensure();
      if (player && ready) player.cueVideoById(tracks[index].id);
    },
    destroy() {
      destroyed = true;
      watch(false);
      try { player?.destroy(); } catch { /* already gone */ }
      player = null;
    }
  };
}
