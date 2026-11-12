import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { BACKDROPS, EFFECTS, GIF_RAW_MAX, MAX_EFFECTS, SPLASHES, activeBackdrop, normalizeLogoImage, normalizeSettings, normalizeSplashImage, splashFullPath, splashPreviewPath } from "../js/looks.js";
import { demoProfile } from "../js/model.js";

test("there are at least 12 splashes and 15 effects", () => {
  assert.ok(SPLASHES.length >= 12);
  assert.ok(EFFECTS.length >= 15);
  assert.equal(new Set(SPLASHES.map((item) => item.id)).size, SPLASHES.length);
  assert.equal(new Set(EFFECTS.map((item) => item.id)).size, EFFECTS.length);
});

test("settings keep known choices and cap the stack", () => {
  const settings = normalizeSettings({
    splash: "vhs",
    effects: ["snow", "nope", "snow", ...EFFECTS.map((item) => item.id)]
  });
  assert.equal(settings.splash, "vhs");
  assert.equal(settings.effects.length, MAX_EFFECTS);
  assert.equal(settings.effects[0], "snow");
  assert.equal(normalizeSettings({ splash: "nope" }).splash, "ghost");
});

test("the settings guard accepts the same splash and effect ids", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261112070000_ghostlinks_settings_guard.sql", import.meta.url), "utf8");
  for (const splash of SPLASHES) assert.match(sql, new RegExp(`'${splash.id}'`));
  for (const effect of EFFECTS) assert.match(sql, new RegExp(`'${effect.id}'`));
  assert.match(sql, /ghostlinks_internal\.ghostlinks_guard_profile/);
  assert.match(sql, /> 10/);
  assert.doesNotMatch(sql, /public\.profiles/);
});

test("splash images are presets or small data URLs", () => {
  assert.equal(normalizeSplashImage("assets/splash/splash-01.webp"), "assets/splash/splash-01.webp");
  assert.equal(normalizeSplashImage("assets/splash/splash-12.webp"), "assets/splash/splash-12.webp");
  assert.equal(normalizeSplashImage("assets/splash/splash-20.webp"), "assets/splash/splash-20.webp");
  assert.equal(normalizeSplashImage("assets/splash/splash-21.webp"), "assets/splash/splash-21.webp");
  assert.equal(normalizeSplashImage("assets/splash/splash-32.webp"), "assets/splash/splash-32.webp");
  assert.equal(normalizeSplashImage("assets/splash/splash-33.webp"), "");
  assert.equal(normalizeSplashImage("assets/splash/splash-99.webp"), "");
  assert.equal(normalizeSplashImage("javascript:alert(1)"), "");
  assert.equal(normalizeSettings({ splash_image: "https://evil.example/a.png" }).splash_image, "");
  assert.equal(normalizeSettings({ splash_image: "assets/splash/splash-03.webp" }).splash_image, "assets/splash/splash-03.webp");
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261112080000_ghostlinks_splash_image_guard.sql", import.meta.url), "utf8");
  assert.match(sql, /splash_image/);
  assert.match(sql, /splash-20/);
  assert.doesNotMatch(sql, /alter table public\.profiles/);
});

test("logo marks are preset ghosts or small data URLs", () => {
  assert.equal(normalizeLogoImage("assets/brand/ghosts/ghost-cute.png"), "assets/brand/ghosts/ghost-cute.png");
  assert.equal(normalizeLogoImage("assets/brand/ghosts/ghost-line.png"), "assets/brand/ghosts/ghost-line.png");
  assert.equal(normalizeLogoImage("https://evil.example/ghost.png"), "");
  assert.equal(normalizeLogoImage("assets/brand/ghosts/../secret.png"), "");
  assert.equal(normalizeSettings({ logo_image: "assets/brand/ghosts/ghost-gold.png" }).logo_image, "assets/brand/ghosts/ghost-gold.png");
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261112100000_ghostlinks_logo_guard.sql", import.meta.url), "utf8");
  assert.match(sql, /logo_image/);
  assert.match(sql, /ghost-\[a-z0-9_-\]\{1,40\}/);
  assert.doesNotMatch(sql, /alter table public\.profiles/);
  assert.doesNotMatch(sql, /drop table/i);
});

test("gallery thumbs stay small and GIFs fit the saved data URL", () => {
  assert.equal(GIF_RAW_MAX, 130000);
  assert.equal(splashPreviewPath({ file: "splash-01.webp", thumb: "splash-01.webp" }), "assets/splash/thumbs/splash-01.webp");
  assert.equal(splashPreviewPath({ file: "splash-02.webp", thumb: "thumbs/splash-02.webp" }), "assets/splash/thumbs/splash-02.webp");
  assert.equal(splashPreviewPath({ file: "splash-03.webp", thumb: "assets/splash/thumbs/splash-03.webp" }), "assets/splash/thumbs/splash-03.webp");
  assert.equal(splashPreviewPath({ file: "splash-04.webp" }), "assets/splash/thumbs/splash-04.webp");
  assert.equal(splashFullPath({ file: "splash-04.webp" }), "assets/splash/splash-04.webp");
  assert.equal(splashPreviewPath({ file: "https://evil.example/a.webp", thumb: "splash-01.webp" }), "");
  assert.equal(splashPreviewPath({ file: "splash-01.webp", thumb: "../secret.webp" }), "assets/splash/thumbs/splash-01.webp");
});

test("animated backgrounds are known ids behind the card", () => {
  assert.ok(BACKDROPS.length >= 12);
  assert.equal(new Set(BACKDROPS.map((item) => item.id)).size, BACKDROPS.length);
  const settings = normalizeSettings({ background: "starfield", background_media: "https://evil.example/a.mp4" });
  assert.equal(settings.background, "starfield");
  assert.equal(settings.background_media, "");
  assert.equal(normalizeSettings({ background: "nope" }).background, "");
  assert.equal(activeBackdrop({ background: "stars", settings: {} }), "starfield");
  assert.equal(activeBackdrop({ background: "grid", settings: { background: "plasma" } }), "plasma");
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261112120000_ghostlinks_animated_background_guard.sql", import.meta.url), "utf8");
  for (const item of BACKDROPS) assert.match(sql, new RegExp(`'${item.id}'`));
  assert.match(sql, /background_media/);
  assert.match(sql, /logo_image/);
  assert.doesNotMatch(sql, /alter table public\.profiles/);
  assert.doesNotMatch(sql, /drop table/i);
});

test("the demo page turns on a splash and several effects", () => {
  const demo = demoProfile();
  assert.equal(demo.settings.splash, "portal");
  assert.ok(demo.settings.effects.includes("fireflies"));
  assert.ok(demo.settings.effects.includes("visualiser"));
});
