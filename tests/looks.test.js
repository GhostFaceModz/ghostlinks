import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { EFFECTS, MAX_EFFECTS, SPLASHES, normalizeSettings, normalizeSplashImage } from "../js/looks.js";
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
  assert.equal(normalizeSplashImage("assets/splash/splash-21.webp"), "");
  assert.equal(normalizeSplashImage("assets/splash/splash-99.webp"), "");
  assert.equal(normalizeSplashImage("javascript:alert(1)"), "");
  assert.equal(normalizeSettings({ splash_image: "https://evil.example/a.png" }).splash_image, "");
  assert.equal(normalizeSettings({ splash_image: "assets/splash/splash-03.webp" }).splash_image, "assets/splash/splash-03.webp");
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261112080000_ghostlinks_splash_image_guard.sql", import.meta.url), "utf8");
  assert.match(sql, /splash_image/);
  assert.match(sql, /splash-20/);
  assert.doesNotMatch(sql, /alter table public\.profiles/);
});

test("the demo page turns on a splash and several effects", () => {
  const demo = demoProfile();
  assert.equal(demo.settings.splash, "portal");
  assert.ok(demo.settings.effects.includes("fireflies"));
  assert.ok(demo.settings.effects.includes("visualiser"));
});
