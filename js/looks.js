/** Splash styles and combinable page effects. Ids are what we store. */

export const SPLASHES = [
  { id: "ghost", label: "Ghost float", tag: "Signature", hint: "The classic bob, then it flies away" },
  { id: "glitch", label: "Glitch", tag: "Type", hint: "Sliced, jittering type" },
  { id: "neon", label: "Neon flicker", tag: "Light", hint: "A sign that will not stay lit" },
  { id: "smoke", label: "Smoke", tag: "Atmosphere", hint: "The name clears out of fog" },
  { id: "burst", label: "Particle burst", tag: "Motion", hint: "Sparks around the ghost" },
  { id: "typewriter", label: "Typewriter", tag: "Type", hint: "The name types itself" },
  { id: "vhs", label: "VHS", tag: "Retro", hint: "Scanlines and a soft wobble" },
  { id: "matrix", label: "Matrix", tag: "Retro", hint: "Green rain behind the title" },
  { id: "dissolve", label: "Dissolve", tag: "Motion", hint: "The ghost melts into blur" },
  { id: "portal", label: "Portal", tag: "Atmosphere", hint: "Ripples opening in the dark" },
  { id: "floatin", label: "Float in", tag: "Signature", hint: "The ghost rises into place" },
  { id: "shatter", label: "Shattered glass", tag: "Type", hint: "The title breaks apart" },
  { id: "fade", label: "Minimal fade", tag: "Minimal", hint: "Almost nothing, then the page" }
];

export const EFFECTS = [
  { id: "snow", label: "Snow", tag: "Weather" },
  { id: "rain", label: "Rain", tag: "Weather" },
  { id: "stars", label: "Stars", tag: "Sky" },
  { id: "fireflies", label: "Fireflies", tag: "Sky" },
  { id: "ghosts", label: "Floating ghosts", tag: "Signature" },
  { id: "sakura", label: "Sakura", tag: "Weather" },
  { id: "bubbles", label: "Bubbles", tag: "Motion" },
  { id: "smoke", label: "Smoke", tag: "Atmosphere" },
  { id: "aurora", label: "Aurora wash", tag: "Atmosphere" },
  { id: "trail", label: "Cursor trail", tag: "Pointer" },
  { id: "sparkle", label: "Sparkle cursor", tag: "Pointer" },
  { id: "tilt", label: "Tilt card", tag: "Card" },
  { id: "glow", label: "Glow border", tag: "Card" },
  { id: "typewriter", label: "Typewriter bio", tag: "Type" },
  { id: "rainbow", label: "Gradient name", tag: "Type" },
  { id: "glitch", label: "Glitch name", tag: "Type" },
  { id: "parallax", label: "Parallax", tag: "Motion" },
  { id: "visualiser", label: "Visualizer bars", tag: "Audio" }
];

export const MAX_EFFECTS = 10;
const SPLASH_IDS = new Set(SPLASHES.map((item) => item.id));
const EFFECT_IDS = new Set(EFFECTS.map((item) => item.id));

const SPLASH_FILE = /^splash-(0[1-9]|[12][0-9]|3[0-2])\.webp$/;
const PRESET_IMAGE = /^assets\/splash\/splash-(0[1-9]|[12][0-9]|3[0-2])\.webp$/;
const LOGO_PRESET = /^assets\/brand\/ghosts\/ghost-[a-z0-9_-]{1,40}\.png$/;
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i;

/** Base64 of a data URL must stay within 180000 characters. 130KB raw is under that cap. */
export const DATA_IMAGE_MAX = 180000;
export const GIF_RAW_MAX = 130000;

export function splashFullPath(item = {}) {
  const file = String(item.file || "");
  return SPLASH_FILE.test(file) ? `assets/splash/${file}` : "";
}

/** Gallery <img> source. Prefer manifest `thumb`, then assets/splash/thumbs/, never a path outside that set. */
export function splashPreviewPath(item = {}) {
  const file = String(item.file || "");
  if (!SPLASH_FILE.test(file)) return "";
  const thumb = String(item.thumb || "").replace(/\\/g, "/").trim();
  if (thumb) {
    const base = thumb.split("/").filter(Boolean).pop();
    if (SPLASH_FILE.test(base)) {
      if (thumb.startsWith("assets/splash/")) return thumb;
      if (thumb.startsWith("thumbs/")) return `assets/splash/${thumb}`;
      return `assets/splash/thumbs/${base}`;
    }
  }
  return `assets/splash/thumbs/${file}`;
}

export function normalizeLogoImage(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (LOGO_PRESET.test(raw)) return raw;
  if (DATA_IMAGE.test(raw) && raw.length <= DATA_IMAGE_MAX) return raw;
  return "";
}

export function normalizeSplashImage(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (PRESET_IMAGE.test(raw)) return raw;
  if (DATA_IMAGE.test(raw) && raw.length <= DATA_IMAGE_MAX) return raw;
  return "";
}

const FRAME_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const BACKDROP_MEDIA = /^data:(image\/gif|video\/webm|video\/mp4);base64,[a-z0-9+/=]+$/i;

export const BACKDROPS = [
  { id: "aurora", label: "Aurora waves", tag: "Sky", column: "aurora" },
  { id: "mesh", label: "Violet mesh", tag: "Glow", column: "aurora" },
  { id: "starfield", label: "Starfield", tag: "Night", column: "stars" },
  { id: "matrix", label: "Matrix rain", tag: "Code", column: "rain" },
  { id: "fog", label: "Smoke", tag: "Soft", column: "still" },
  { id: "bokeh", label: "Bokeh", tag: "Light", column: "stars" },
  { id: "synthwave", label: "Neon grid", tag: "Retro", column: "grid" },
  { id: "caustics", label: "Caustics", tag: "Water", column: "still" },
  { id: "constellation", label: "Constellation", tag: "Night", column: "stars" },
  { id: "lava", label: "Lava lamp", tag: "Glow", column: "embers" },
  { id: "snow", label: "Snowfall", tag: "Weather", column: "rain" },
  { id: "rain", label: "Rain on glass", tag: "Weather", column: "rain" },
  { id: "mist", label: "Ghostly mist", tag: "Soft", column: "still" },
  { id: "plasma", label: "Plasma", tag: "Glow", column: "aurora" }
];

const BACKDROP_IDS = new Set(BACKDROPS.map((item) => item.id).concat("custom"));
const LEGACY_BACKDROP = { aurora: "aurora", stars: "starfield", rain: "rain", grid: "synthwave", embers: "lava", still: "mist" };

export function normalizeBackdrop(value) {
  if (value == null || String(value).trim() === "") return "";
  return BACKDROP_IDS.has(value) ? value : "";
}

export function normalizeBackdropMedia(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (BACKDROP_MEDIA.test(raw) && raw.length <= DATA_IMAGE_MAX) return raw;
  return "";
}

export function columnBackground(id) {
  return BACKDROPS.find((item) => item.id === id)?.column || "still";
}

export function activeBackdrop(profile = {}) {
  const chosen = profile.settings?.background;
  const media = normalizeBackdropMedia(profile.settings?.background_media);
  if (chosen === "custom" && media) return "custom";
  if (BACKDROPS.some((item) => item.id === chosen)) return chosen;
  return LEGACY_BACKDROP[profile.background] || "aurora";
}

export function normalizeSettings(input = {}) {
  const splash = SPLASH_IDS.has(input.splash) ? input.splash : "ghost";
  const effects = [];
  const source = Array.isArray(input.effects) ? input.effects : [];
  for (const id of source) {
    if (!EFFECT_IDS.has(id) || effects.includes(id)) continue;
    effects.push(id);
    if (effects.length >= MAX_EFFECTS) break;
  }
  const background_media = normalizeBackdropMedia(input.background_media);
  let background = normalizeBackdrop(input.background);
  if (background === "custom" && !background_media) background = "";
  if (!background && background_media) background = "custom";
  return {
    splash,
    effects,
    splash_image: normalizeSplashImage(input.splash_image),
    logo_image: normalizeLogoImage(input.logo_image),
    avatar_frame: normalizeAvatarFrame(input.avatar_frame),
    background,
    background_media
  };
}

export function normalizeAvatarFrame(value) {
  const raw = String(value || "").trim().toLowerCase();
  return FRAME_ID.test(raw) ? raw : "";
}

export const TEMPLATES = [
  { id: "portal", name: "Portal night", theme: "nebula", background: "aurora", accent: "#8f6cff", splash: "portal", splash_image: "assets/splash/splash-01.webp", effects: ["fireflies", "glow", "aurora", "rainbow"] },
  { id: "signal", name: "Void signal", theme: "void", background: "grid", accent: "#c4b5fd", splash: "glitch", splash_image: "assets/splash/splash-08.webp", effects: ["glitch", "rain", "stars"] },
  { id: "frost", name: "Frost glass", theme: "frost", background: "stars", accent: "#36c8ff", splash: "dissolve", splash_image: "assets/splash/splash-12.webp", effects: ["snow", "stars", "glow"] },
  { id: "rose", name: "Rose bloom", theme: "rose", background: "rain", accent: "#ff6ad5", splash: "floatin", splash_image: "assets/splash/splash-05.webp", effects: ["sakura", "sparkle", "rainbow"] },
  { id: "ember", name: "Ember burst", theme: "ember", background: "embers", accent: "#ff7a3c", splash: "burst", splash_image: "assets/splash/splash-16.webp", effects: ["sparkle", "glow", "trail"] },
  { id: "mint", name: "Mint drift", theme: "mint", background: "aurora", accent: "#3ee0b0", splash: "smoke", splash_image: "assets/splash/splash-20.webp", effects: ["bubbles", "aurora", "visualiser"] }
];
