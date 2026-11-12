import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { EFFECTS, MAX_EFFECTS, SPLASHES, normalizeSettings } from "../js/looks.js";
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

test("the demo page turns on a splash and several effects", () => {
  const demo = demoProfile();
  assert.equal(demo.settings.splash, "portal");
  assert.ok(demo.settings.effects.includes("fireflies"));
  assert.ok(demo.settings.effects.includes("visualiser"));
});
