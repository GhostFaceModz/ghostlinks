import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { BACKDROPS, EFFECTS, GIF_RAW_MAX, GHOST_MARKS, MAX_EFFECTS, SPLASHES, TEMPLATES, activeBackdrop, defaultGhostId, normalizeAvatarChoice, normalizeAvatarFrame, normalizeLogoImage, normalizeSettings, normalizeSplashImage, resolveAvatar, splashFullPath, splashPreviewPath } from "../js/looks.js";
import { demoProfile, profileBadges } from "../js/model.js";

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
  assert.match(sql, /avatar_frame/);
  assert.doesNotMatch(sql, /alter table public\.profiles/);
  assert.doesNotMatch(sql, /drop table/i);
  const avatarSql = fs.readFileSync(new URL("../supabase/migrations/20261112130000_ghostlinks_avatar_guard.sql", import.meta.url), "utf8");
  for (const key of ["splash", "effects", "splash_image", "logo_image", "avatar_frame", "background", "background_media", "avatar"]) {
    assert.match(avatarSql, new RegExp(`'${key}'`));
  }
  for (const item of BACKDROPS) assert.match(avatarSql, new RegExp(`'${item.id}'`));
  assert.doesNotMatch(avatarSql, /alter table public\.profiles/);
  assert.equal(normalizeAvatarChoice("Cyber-Mask"), "cyber-mask");
  assert.equal(normalizeAvatarChoice("../x"), "");
  assert.equal(defaultGhostId("#36c8ff"), "cool");
  assert.equal(defaultGhostId("#8f6cff"), "cute");
  assert.equal(GHOST_MARKS.length, 6);
  const manifest = JSON.parse(fs.readFileSync(new URL("../assets/brand/avatars/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.length, 12);
  const premium = manifest.map((item) => ({ id: item.id, file: item.file }));
  const picked = resolveAvatar({ accent: "#8f6cff", settings: { avatar: "cat-ghost" } }, premium);
  assert.equal(picked.src, "assets/brand/avatars/avatar-cat-ghost.webp");
  assert.equal(picked.photo, true);
  const fallback = resolveAvatar({ accent: "#8f6cff", avatarUrl: "", settings: {} });
  assert.equal(fallback.src, "assets/brand/ghosts/ghost-cute.png");
  assert.equal(normalizeSettings({ avatar: "hooded-neon-ghost", background: "aurora" }).avatar, "hooded-neon-ghost");
});

test("templates, frames, and demo badges stay in range", () => {
  assert.equal(TEMPLATES.length, 6);
  for (const template of TEMPLATES) {
    const settings = normalizeSettings({
      background: "plasma",
      background_media: "",
      avatar_frame: "neon-ring",
      splash: template.splash,
      splash_image: template.splash_image,
      effects: template.effects
    });
    assert.equal(settings.splash, template.splash);
    assert.equal(settings.splash_image, template.splash_image);
    assert.equal(settings.background, "plasma");
    assert.equal(settings.avatar_frame, "neon-ring");
    assert.ok(settings.effects.length >= 3);
  }
  assert.equal(normalizeAvatarFrame("Gold-Ring"), "gold-ring");
  assert.equal(normalizeAvatarFrame("neon-ring"), "neon-ring");
  assert.equal(normalizeAvatarFrame("../x"), "");
  const badges = profileBadges(demoProfile());
  assert.ok(badges.some((badge) => badge.id === "discord"));
  assert.ok(badges.some((badge) => badge.id === "music"));
  const views = fs.readFileSync(new URL("../supabase/migrations/20261112110000_ghostlinks_views.sql", import.meta.url), "utf8");
  assert.match(views, /ghostlinks_views/);
  assert.match(views, /ghostlinks_record_view/);
  assert.match(views, /6 hours/);
  assert.match(views, /enable row level security/);
  assert.match(views, /force row level security/);
  assert.doesNotMatch(views, /alter table public\.profiles/);
});

test("the demo page turns on a splash and several effects", () => {
  const demo = demoProfile();
  assert.equal(demo.settings.splash, "portal");
  assert.ok(demo.settings.effects.includes("fireflies"));
  assert.ok(demo.settings.effects.includes("visualiser"));
});
