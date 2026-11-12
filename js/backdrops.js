/** Full-viewport backdrops behind the profile card. Motion is transform and opacity. */

import { el } from "./dom.js";
import { BACKDROPS, activeBackdrop, columnBackground, normalizeBackdropMedia } from "./looks.js";

const MEDIA_MAX = 180000;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function lite() {
  return window.matchMedia("(max-width: 700px), (hover: none)").matches;
}

function bits(count) {
  const total = lite() ? Math.min(count, 8) : count;
  const nodes = [];
  for (let i = 0; i < total; i += 1) {
    const node = document.createElement("i");
    node.style.setProperty("--n", String(i));
    nodes.push(node);
  }
  return nodes;
}

export function backdropLayer(id) {
  const root = document.createElement("div");
  root.className = `backdrop bd-${id}`;
  const counts = {
    aurora: 4, mesh: 4, starfield: 16, matrix: 10, fog: 5, bokeh: 8,
    synthwave: 1, caustics: 6, constellation: 10, lava: 4, snow: 14, rain: 12, mist: 5, plasma: 4
  };
  if (id !== "synthwave") root.append(...bits(counts[id] || 6));
  return root;
}

function mediaNode(src) {
  if (src.startsWith("data:video/")) {
    const video = document.createElement("video");
    video.className = "backdrop-media";
    video.src = src;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    return video;
  }
  const image = document.createElement("img");
  image.className = "backdrop-media";
  image.alt = "";
  image.src = src;
  return image;
}

export function mountBackdrop(scene, id, media = "") {
  scene.replaceChildren();
  const cleanMedia = normalizeBackdropMedia(media);
  const known = ["aurora", "mesh", "starfield", "matrix", "fog", "bokeh", "synthwave", "caustics", "constellation", "lava", "snow", "rain", "mist", "plasma"];
  const name = id === "custom" && cleanMedia ? "custom" : (known.includes(id) ? id : "aurora");
  scene.dataset.bg = name;
  let video = null;
  if (name === "custom" && cleanMedia) {
    const node = mediaNode(cleanMedia);
    scene.append(node);
    if (node.tagName === "VIDEO") video = node;
  } else {
    scene.append(backdropLayer(name));
  }
  const vignette = document.createElement("div");
  vignette.className = "vignette";
  scene.append(vignette);

  let motionOn = !reduced();
  function applyMotion() {
    scene.classList.toggle("backdrop-still", !motionOn || reduced() || document.hidden);
    if (!video) return;
    if (motionOn && !document.hidden && !reduced()) video.play().catch(() => {});
    else video.pause();
  }
  const onHide = () => applyMotion();
  document.addEventListener("visibilitychange", onHide);
  applyMotion();

  return {
    stop() {
      document.removeEventListener("visibilitychange", onHide);
      video?.pause();
    },
    setMotion(value) {
      motionOn = value && !reduced();
      applyMotion();
    }
  };
}

export function readBackdrop(profile) {
  return {
    id: activeBackdrop(profile),
    media: normalizeBackdropMedia(profile.settings?.background_media)
  };
}

export function mountBackdropCards(container, profile, onPick) {
  container.classList.add("market-grid");
  container.replaceChildren();
  const chosen = activeBackdrop(profile);
  const cards = [];
  for (const item of BACKDROPS) {
    const pressed = chosen === item.id;
    const stage = el("span", { class: `bd-stage bd-${item.id}`, "aria-hidden": "true" });
    stage.append(...bits(item.id === "starfield" || item.id === "snow" || item.id === "rain" ? 8 : 5));
    const button = el("button", {
      type: "button",
      class: "market-card",
      "aria-pressed": String(pressed)
    }, [
      stage,
      el("span", { class: "market-copy" }, [el("strong", {}, item.label), el("em", {}, item.tag)])
    ]);
    button.addEventListener("click", () => {
      onPick(item.id, columnBackground(item.id));
      container.querySelectorAll(".market-card").forEach((node) => node.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
    });
    container.append(button);
    cards.push(button);
  }
  if (reduced() || !("IntersectionObserver" in window)) {
    cards.forEach((card) => card.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle("is-visible", entry.isIntersecting);
  }, { rootMargin: "80px" });
  cards.forEach((card) => observer.observe(card));
}

export function readBackdropFile(file) {
  const ok = file && (file.type === "image/gif" || file.type === "video/webm" || file.type === "video/mp4");
  if (!ok) return Promise.reject(new Error("Use a GIF, WebM, or MP4."));
  if (file.size > 130000) {
    return Promise.reject(new Error("Keep background clips under 130 KB so the page stays fast."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      if (!normalizeBackdropMedia(data) || data.length > MEDIA_MAX) {
        reject(new Error("That clip is too large to save. Keep it under 130 KB."));
        return;
      }
      resolve(data);
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}
