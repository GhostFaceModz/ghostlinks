/** Profile shape, validation, and the built-in demo page. Pure: no DOM. */

import { normalizeSettings } from "./looks.js";

export const RESERVED_USERNAMES = [
  "admin",
  "api",
  "ghostflix",
  "ghostgames",
  "ghostfacezen",
  "www",
  "editor",
  "create",
  "index",
  "demo",
  "login",
  "signin",
  "signup",
  "auth",
  "callback",
  "assets",
  "css",
  "js",
  "fonts",
  "supabase",
  "config",
  "ghostlinks",
  "ghostapps",
  "support",
  "help",
  "about",
  "static",
  "app",
  "dashboard",
  "settings",
  "account",
  "favicon",
  "public",
  "user",
  "users",
  "null",
  "undefined",
  "404",
  "redirect",
  "tests"
];

const RESERVED = new Set(RESERVED_USERNAMES);

export const THEMES = {
  nebula: { label: "Nebula", base: "#07060f", ink: "#f6f3ff", muted: "#b7b1cf", accent: "#8f6cff" },
  void: { label: "Void", base: "#050506", ink: "#f5f5f6", muted: "#b4b4be", accent: "#c4b5fd" },
  frost: { label: "Frost", base: "#061018", ink: "#eef8ff", muted: "#a9c6d6", accent: "#36c8ff" },
  rose: { label: "Rose", base: "#12060e", ink: "#ffeaf6", muted: "#e0b3c8", accent: "#ff6ad5" },
  ember: { label: "Ember", base: "#100804", ink: "#fff3ea", muted: "#e2c2ae", accent: "#ff7a3c" },
  mint: { label: "Mint", base: "#04110e", ink: "#e9fff6", muted: "#b7e0cf", accent: "#3ee0b0" }
};

export const BACKGROUNDS = {
  aurora: { label: "Aurora", hint: "Soft colour drifts" },
  stars: { label: "Starfield", hint: "Slow dust and the odd shooting star" },
  rain: { label: "Rain", hint: "A light curtain of drops" },
  grid: { label: "Grid", hint: "A quiet moving floor" },
  embers: { label: "Embers", hint: "A few rising sparks" },
  still: { label: "Still", hint: "No motion, just glow" }
};

export const FONTS = {
  unbounded: { label: "Unbounded", display: '"Unbounded", "Segoe UI", system-ui, sans-serif', ui: '"Inter", "Segoe UI", system-ui, sans-serif' },
  syne: { label: "Syne", display: '"Syne", "Segoe UI", system-ui, sans-serif', ui: '"Inter", "Segoe UI", system-ui, sans-serif' },
  outfit: { label: "Outfit", display: '"Outfit", "Segoe UI", system-ui, sans-serif', ui: '"Outfit", "Segoe UI", system-ui, sans-serif' },
  grotesk: { label: "Space Grotesk", display: '"Space Grotesk", "Segoe UI", system-ui, sans-serif', ui: '"Inter", "Segoe UI", system-ui, sans-serif' },
  fraunces: { label: "Fraunces", display: '"Fraunces", Georgia, "Times New Roman", serif', ui: '"Inter", "Segoe UI", system-ui, sans-serif' },
  system: { label: "System", display: 'system-ui, "Segoe UI", sans-serif', ui: 'system-ui, "Segoe UI", sans-serif' }
};

export const PLATFORMS = [
  { id: "discord", label: "Discord", hosts: ["discord.com", "discord.gg"] },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be", "music.youtube.com"] },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { id: "x", label: "X", hosts: ["x.com", "twitter.com"] },
  { id: "instagram", label: "Instagram", hosts: ["instagram.com"] },
  { id: "twitch", label: "Twitch", hosts: ["twitch.tv"] },
  { id: "github", label: "GitHub", hosts: ["github.com"] },
  { id: "spotify", label: "Spotify", hosts: ["spotify.com", "open.spotify.com"] },
  { id: "custom", label: "Link", hosts: [] }
];

const PLATFORM_IDS = new Set(PLATFORMS.map((item) => item.id));
const YT_ID = /^[a-zA-Z0-9_-]{11}$/;
const USERNAME = /^[a-z][a-z0-9_]{2,19}$/;
export const LIMITS = { links: 10, tracks: 5, bio: 280, name: 40, label: 32, avatar: 380000 };

export function normalizeAccent(input, fallback = "#8f6cff") {
  const value = String(input || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

export function safeHttps(input) {
  try {
    const url = new URL(String(input || "").trim());
    if (url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function safeAvatar(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (/^https:\/\//i.test(value)) return safeHttps(value);
  const compact = value.replace(/\s/g, "");
  if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(compact) && compact.length <= LIMITS.avatar) {
    return compact.replace(/^data:image\/jpg/i, "data:image/jpeg");
  }
  return "";
}

export function platformFromUrl(input) {
  const safe = safeHttps(input);
  if (!safe) return "custom";
  try {
    const host = new URL(safe).hostname.replace(/^www\./, "").toLowerCase();
    for (const platform of PLATFORMS) {
      if (platform.hosts.some((item) => host === item || host.endsWith(`.${item}`))) return platform.id;
    }
  } catch {
    /* ignore */
  }
  return "custom";
}

export function platformLabel(id) {
  return PLATFORMS.find((item) => item.id === id)?.label || "Link";
}

export function parseYouTubeId(input) {
  const raw = String(input || "").trim();
  if (YT_ID.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return YT_ID.test(id) ? id : "";
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const fromQuery = url.searchParams.get("v") || "";
      if (YT_ID.test(fromQuery)) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live", "v"].includes(parts[0]) && YT_ID.test(parts[1] || "")) return parts[1];
    }
  } catch {
    /* not a URL */
  }
  return "";
}

export function validateUsername(input) {
  const username = String(input || "").trim().toLowerCase();
  if (!username) return { ok: false, username, code: "empty", message: "Choose a username." };
  if (!USERNAME.test(username)) {
    return {
      ok: false,
      username,
      code: "invalid",
      message: "Use 3–20 characters: start with a letter, then letters, numbers, or underscores."
    };
  }
  if (RESERVED.has(username)) return { ok: false, username, code: "reserved", message: "That username is reserved." };
  return { ok: true, username, code: "valid", message: "Format looks good." };
}

function clip(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeProfile(input = {}) {
  const theme = THEMES[input.theme] ? input.theme : "nebula";
  const background = BACKGROUNDS[input.background] ? input.background : "aurora";
  const font = FONTS[input.font] ? input.font : "unbounded";
  const accent = normalizeAccent(input.accent, THEMES[theme].accent);
  const links = [];
  for (const item of Array.isArray(input.links) ? input.links : []) {
    if (links.length >= LIMITS.links) break;
    const url = safeHttps(item && item.url);
    if (!url) continue;
    const platform = PLATFORM_IDS.has(item.platform) ? item.platform : platformFromUrl(url);
    const label = clip(item.label, LIMITS.label) || platformLabel(platform);
    links.push({ url, platform, label });
  }
  const tracks = [];
  const seen = new Set();
  for (const item of Array.isArray(input.tracks) ? input.tracks : []) {
    if (tracks.length >= LIMITS.tracks) break;
    const id = parseYouTubeId(item && (item.id || item.url));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    tracks.push({
      id,
      title: clip(item.title, 80),
      artist: clip(item.artist, 80)
    });
  }
  const rawName = String(input.username || "").trim().toLowerCase();
  // Reserved names stay visible on the built-in demo. Saving them is still rejected.
  const username = USERNAME.test(rawName) ? rawName : "";
  return {
    username,
    displayName: clip(input.displayName, LIMITS.name),
    bio: String(input.bio || "").replace(/\r\n/g, "\n").trim().slice(0, LIMITS.bio),
    avatarUrl: safeAvatar(input.avatarUrl),
    theme,
    background,
    accent,
    font,
    enterScreen: input.enterScreen !== false,
    published: input.published !== false,
    settings: normalizeSettings(input.settings),
    links,
    tracks
  };
}

/** Editor-facing checks. Blank link/track rows are ignored; half-finished ones are errors. */
export function profileIssues(raw = {}) {
  const issues = [];
  const username = validateUsername(raw.username || "");
  if (!username.ok) issues.push({ field: "username", message: username.message });
  const displayName = clip(raw.displayName, 80);
  if (!displayName) issues.push({ field: "displayName", message: "Add a display name." });
  else if (displayName.length > LIMITS.name) issues.push({ field: "displayName", message: "Display name must be 40 characters or fewer." });
  if (String(raw.bio || "").trim().length > LIMITS.bio) issues.push({ field: "bio", message: "Bio must be 280 characters or fewer." });
  if (raw.avatarUrl && !safeAvatar(raw.avatarUrl)) issues.push({ field: "avatar", message: "Avatar must be an https link or a small PNG, JPEG, WebP, or GIF." });
  const links = Array.isArray(raw.links) ? raw.links : [];
  if (links.length > LIMITS.links) issues.push({ field: "links", message: "You can add up to 10 links." });
  links.forEach((link, index) => {
    const url = String(link?.url || "").trim();
    if (!url) return;
    if (!safeHttps(url)) issues.push({ field: "links", message: `Link ${index + 1} needs a full https URL.` });
  });
  const tracks = Array.isArray(raw.tracks) ? raw.tracks : [];
  if (tracks.length > LIMITS.tracks) issues.push({ field: "tracks", message: "You can add up to 5 tracks." });
  tracks.forEach((track, index) => {
    const value = String(track?.url || track?.id || "").trim();
    if (!value) return;
    if (!parseYouTubeId(value)) issues.push({ field: "tracks", message: `Track ${index + 1} needs a YouTube or YouTube Music link.` });
  });
  return issues;
}

export function suggestUsername(input) {
  const slug = String(input || "").toLowerCase().replace(/[^a-z0-9_]/g, "").replace(/^[^a-z]+/, "").slice(0, 20);
  return validateUsername(slug).ok ? slug : "";
}

export function demoProfile() {
  return normalizeProfile({
    username: "demo",
    displayName: "GhostLink",
    bio: "Free animated bio pages. No ads, no trackers, no code. One ghost, a whole set of links.",
    avatarUrl: "",
    theme: "nebula",
    background: "aurora",
    accent: "#8f6cff",
    font: "unbounded",
    enterScreen: true,
    published: true,
    settings: { splash: "portal", effects: ["fireflies", "ghosts", "glow", "rainbow", "visualiser", "aurora"] },
    links: [
      { url: "https://ghostflix.uk", label: "GhostFlix", platform: "custom" },
      { url: "https://ghostgames.app", label: "GhostGames", platform: "custom" },
      { url: "https://www.youtube.com/@GhostGames_App", label: "YouTube", platform: "youtube" },
      { url: "https://github.com/GhostFaceModz", label: "GitHub", platform: "github" }
    ],
    tracks: [
      { id: "8xdmFpNb8EI", title: "It’s Not So Bad (Trap Remix)", artist: "Faze Beats" },
      { id: "DZrG_Cjx1L8", title: "13", artist: "Lund" },
      { id: "oblsGyGuoIY", title: "Been Here Before", artist: "GTW Mik" }
    ]
  });
}

export function starterProfile(seed = {}) {
  const suggested = suggestUsername(seed.username || seed.displayName || "");
  return {
    username: suggested,
    displayName: clip(seed.displayName, LIMITS.name) || "Your name",
    bio: "Building something in the GhostApps universe.",
    avatarUrl: safeAvatar(seed.avatarUrl),
    theme: "nebula",
    background: "aurora",
    accent: "#8f6cff",
    font: "unbounded",
    enterScreen: true,
    published: true,
    settings: { splash: "ghost", effects: ["glow", "rainbow"] },
    links: [
      { url: "https://ghostflix.uk", label: "GhostFlix", platform: "custom" },
      { url: "https://ghostgames.app", label: "GhostGames", platform: "custom" },
      { url: "https://www.youtube.com/@GhostGames_App", label: "YouTube", platform: "youtube" }
    ],
    tracks: [
      { id: "8xdmFpNb8EI", url: "https://www.youtube.com/watch?v=8xdmFpNb8EI", title: "It’s Not So Bad (Trap Remix)", artist: "Faze Beats" }
    ]
  };
}
