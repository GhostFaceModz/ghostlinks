/** Splash styles and combinable page effects. Ids are what we store. */

export const SPLASHES = [
  { id: "ghost", label: "Ghost float", hint: "The classic bob, then it flies away" },
  { id: "glitch", label: "Glitch", hint: "Sliced, jittering type" },
  { id: "neon", label: "Neon flicker", hint: "A sign that will not stay lit" },
  { id: "smoke", label: "Smoke", hint: "The name clears out of fog" },
  { id: "burst", label: "Particle burst", hint: "Sparks around the ghost" },
  { id: "typewriter", label: "Typewriter", hint: "The name types itself" },
  { id: "vhs", label: "VHS", hint: "Scanlines and a soft wobble" },
  { id: "matrix", label: "Matrix", hint: "Green rain behind the title" },
  { id: "dissolve", label: "Dissolve", hint: "The ghost melts into blur" },
  { id: "portal", label: "Portal", hint: "Ripples opening in the dark" },
  { id: "floatin", label: "Float in", hint: "The ghost rises into place" },
  { id: "shatter", label: "Shattered glass", hint: "The title breaks apart" },
  { id: "fade", label: "Minimal fade", hint: "Almost nothing, then the page" }
];

export const EFFECTS = [
  { id: "snow", label: "Snow" },
  { id: "rain", label: "Rain" },
  { id: "stars", label: "Stars" },
  { id: "fireflies", label: "Fireflies" },
  { id: "ghosts", label: "Floating ghosts" },
  { id: "sakura", label: "Sakura" },
  { id: "bubbles", label: "Bubbles" },
  { id: "smoke", label: "Smoke" },
  { id: "aurora", label: "Aurora wash" },
  { id: "trail", label: "Cursor trail" },
  { id: "sparkle", label: "Sparkle cursor" },
  { id: "tilt", label: "Tilt card" },
  { id: "glow", label: "Glow border" },
  { id: "typewriter", label: "Typewriter bio" },
  { id: "rainbow", label: "Gradient name" },
  { id: "glitch", label: "Glitch name" },
  { id: "parallax", label: "Parallax" },
  { id: "visualiser", label: "Visualizer bars" }
];

export const MAX_EFFECTS = 10;
const SPLASH_IDS = new Set(SPLASHES.map((item) => item.id));
const EFFECT_IDS = new Set(EFFECTS.map((item) => item.id));

export function normalizeSettings(input = {}) {
  const splash = SPLASH_IDS.has(input.splash) ? input.splash : "ghost";
  const effects = [];
  const source = Array.isArray(input.effects) ? input.effects : [];
  for (const id of source) {
    if (!EFFECT_IDS.has(id) || effects.includes(id)) continue;
    effects.push(id);
    if (effects.length >= MAX_EFFECTS) break;
  }
  return { splash, effects };
}
