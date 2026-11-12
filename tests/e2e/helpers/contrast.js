/**
 * Pixel-based WCAG text contrast for text drawn over photos and animated backdrops.
 *
 * axe-core reports text over images as "incomplete", so it can't gate this. Instead, for each
 * text element we:
 *   1. read its computed text colour (or every stop of a background-clip:text gradient),
 *      its own alpha, and the product of ancestor opacities,
 *   2. make the text invisible (color/-webkit-text-fill-color transparent, text-shadow none,
 *      gradient fill removed) and screenshot its bounding box to get the real backdrop pixels,
 *   3. take the pixel at the 90th-percentile relative luminance (the bright end of the
 *      backdrop, the worst realistic case for light text),
 *   4. blend a semi-transparent text colour over that pixel and compute the WCAG ratio.
 * Text-shadow is recorded but not credited (WCAG and axe don't credit halos); a fix should
 * darken what's behind the text (a scrim, a darker pill or card), not rely on a glow.
 */
import { expect } from "@playwright/test";

export const MIN_RATIO = 4.5;
export const PROFILE_KEY = "ghostlinks.profile.v1";
export const QA_USER = "contrastqa";

export function linear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function blend([r, g, b, a], [br, bg, bb]) {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
}

/** Parse every rgb()/rgba() colour in a computed style string (Chrome normalises to these). */
export function parseColors(text) {
  const out = [];
  for (const m of String(text || "").matchAll(/rgba?\(([^)]+)\)/g)) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    out.push([parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]);
  }
  return out;
}

/** A demo-mode profile that shows a given splash photo and/or backdrop. */
export function qaProfile({ splash = "", backdrop = "aurora" } = {}) {
  return {
    username: QA_USER,
    displayName: "Ghost Zane",
    bio: "Building something in the GhostApps universe.",
    avatarUrl: "",
    theme: "nebula",
    background: "aurora",
    accent: "#8f6cff",
    font: "unbounded",
    enterScreen: true,
    published: true,
    // glow + rainbow are the starter defaults, so the name uses the gradient fill like real pages.
    settings: {
      splash: "ghost",
      effects: ["glow", "rainbow"],
      splash_image: splash ? `assets/splash/${splash}.webp` : "",
      background: backdrop
    },
    links: [
      { url: "https://ghostflix.uk", label: "GhostFlix", platform: "custom" },
      { url: "https://ghostgames.app", label: "GhostGames", platform: "custom" },
      { url: "https://www.youtube.com/@GhostGames_App", label: "YouTube", platform: "youtube" }
    ],
    tracks: []
  };
}

/**
 * Force demo mode (blank config.js, so no Supabase call) and seed localStorage with the profile,
 * then open the public page for it. The same code path renders the editor Preview.
 */
export async function openQaPage(page, profile, url) {
  await page.route(/\/config\.js(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: 'window.GHOSTLINKS_CONFIG = { supabaseUrl: "", supabaseAnonKey: "" };'
    })
  );
  await page.addInitScript(
    ([key, value]) => {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
    },
    [PROFILE_KEY, JSON.stringify(profile)]
  );
  await page.goto(url);
}

/** Wait for every <img> and CSS background image on the page to finish decoding. */
export async function settleImages(page) {
  await page.evaluate(async () => {
    const urls = new Set();
    for (const node of document.querySelectorAll("*")) {
      const bg = getComputedStyle(node).backgroundImage;
      for (const m of bg.matchAll(/url\("?([^")]+)"?\)/g)) urls.add(m[1]);
    }
    await Promise.all([
      ...[...urls].map((src) => new Promise((done) => { const i = new Image(); i.onload = i.onerror = done; i.src = src; })),
      ...[...document.images].map((img) => (img.complete ? null : new Promise((done) => { img.onload = img.onerror = done; })))
    ]);
    await document.fonts?.ready;
  });
  await page.waitForTimeout(150);
}

/** p90-luminance pixel of a PNG, decoded in a scratch page so the app page is untouched. */
async function brightPixel(scratch, png) {
  return scratch.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const px = [];
    for (let i = 0; i < data.length; i += 4) {
      const L = 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
      px.push([L, data[i], data[i + 1], data[i + 2]]);
    }
    px.sort((a, b) => a[0] - b[0]);
    const p = px[Math.min(px.length - 1, Math.floor(px.length * 0.9))];
    return { rgb: [p[1], p[2], p[3]], lum: p[0], count: px.length };
  }, png.toString("base64"));
}

/**
 * Measure one element. Returns { ratio, text, bg, ... } where ratio is the worst text colour
 * (or gradient stop) against the p90 background pixel.
 */
export async function measureText(page, scratch, locator) {
  await locator.scrollIntoViewIfNeeded();
  const style = await locator.evaluate((node) => {
    const cs = getComputedStyle(node);
    let opacity = 1;
    for (let n = node; n && n.nodeType === 1; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
    // getComputedStyle is live: snapshot everything before the text is hidden below.
    const clipText = /text/.test(cs.backgroundClip) || /text/.test(cs.webkitBackgroundClip || "");
    const snap = {
      color: cs.color, fill: cs.webkitTextFillColor || cs.color, clipText,
      gradient: clipText ? cs.backgroundImage : "", shadow: cs.textShadow, opacity
    };
    const prev = node.getAttribute("style");
    node.dataset.qaPrevStyle = prev == null ? "\u0000" : prev;
    node.style.setProperty("color", "transparent", "important");
    node.style.setProperty("-webkit-text-fill-color", "transparent", "important");
    node.style.setProperty("text-shadow", "none", "important");
    if (clipText) node.style.setProperty("background", "none", "important");
    const r = node.getBoundingClientRect();
    return {
      ...snap,
      box: { x: r.x, y: r.y, width: r.width, height: r.height }
    };
  });
  let png;
  try {
    const vp = page.viewportSize();
    const x = Math.max(0, Math.floor(style.box.x));
    const y = Math.max(0, Math.floor(style.box.y));
    const clip = {
      x, y,
      width: Math.max(1, Math.min(vp.width, Math.ceil(style.box.x + style.box.width)) - x),
      height: Math.max(1, Math.min(vp.height, Math.ceil(style.box.y + style.box.height)) - y)
    };
    png = await page.screenshot({ clip, animations: "disabled", caret: "hide", scale: "css" });
  } finally {
    await locator.evaluate((node) => {
      const prev = node.dataset.qaPrevStyle;
      delete node.dataset.qaPrevStyle;
      if (prev === "\u0000") node.removeAttribute("style");
      else node.setAttribute("style", prev);
    });
  }
  const bg = await brightPixel(scratch, png);
  // -webkit-text-fill-color wins over color and paints on top of a background-clip:text gradient,
  // so the gradient stops only matter when the fill is transparent.
  const fill = parseColors(style.fill)[0];
  const gradientShows = style.clipText && (!fill || fill[3] === 0);
  const colours = gradientShows ? parseColors(style.gradient) : fill ? [fill] : parseColors(style.color);
  let worst = null;
  for (const c of colours) {
    const shown = blend([c[0], c[1], c[2], c[3] * style.opacity], bg.rgb);
    const r = ratio(shown, bg.rgb);
    if (!worst || r < worst.ratio) worst = { ratio: r, text: c.map((v, i) => (i < 3 ? Math.round(v) : +v.toFixed(2))) };
  }
  return {
    ratio: Math.round(worst.ratio * 100) / 100,
    text: worst.text,
    bg: bg.rgb,
    bgLum: Math.round(bg.lum * 1000) / 1000,
    opacity: Math.round(style.opacity * 100) / 100,
    gradient: gradientShows,
    shadow: style.shadow !== "none"
  };
}

export function expectContrast(results) {
  const low = results.filter((r) => r.ratio < MIN_RATIO);
  const lines = results.map((r) => `${r.ratio < MIN_RATIO ? "FAIL" : "ok  "} ${r.ratio.toFixed(2)}:1  ${r.name}  text=${JSON.stringify(r.text)} bg=${JSON.stringify(r.bg)}`);
  expect(low, `contrast below ${MIN_RATIO}:1\n${lines.join("\n")}`).toEqual([]);
}
