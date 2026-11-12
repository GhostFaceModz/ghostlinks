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

const PRESET_IMAGE = /^assets\/splash\/splash-(0[1-9]|1[0-9]|20)\.webp$/;
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i;

export function normalizeSplashImage(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (PRESET_IMAGE.test(raw)) return raw;
  if (DATA_IMAGE.test(raw) && raw.length <= 180000) return raw;
  return "";
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
  return { splash, effects, splash_image: normalizeSplashImage(input.splash_image) };
}
