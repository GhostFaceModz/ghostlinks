import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { isDemoMode, keyLooksLikeServiceRole } from "../js/config-state.js";
import {
  RESERVED_USERNAMES,
  demoProfile,
  normalizeProfile,
  parseYouTubeId,
  platformFromUrl,
  profileIssues,
  safeAvatar,
  safeHttps,
  validateUsername
} from "../js/model.js";
import { editorRedirectUrl, prettyPathRedirect } from "../js/route.js";

test("usernames accept the documented shape and reject reserved names", () => {
  assert.equal(validateUsername("Ghost").username, "ghost");
  assert.equal(validateUsername("ab").ok, false);
  assert.equal(validateUsername("1abc").ok, false);
  assert.equal(validateUsername("ghost face").ok, false);
  for (const name of ["admin", "api", "ghostflix", "ghostgames", "ghostfacezen", "www", "demo", "editor"]) {
    assert.equal(validateUsername(name).code, "reserved", name);
  }
});

test("the SQL migration reserves every name the editor knows", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261112050000_ghostlinks_profiles.sql", import.meta.url), "utf8");
  for (const name of RESERVED_USERNAMES) {
    assert.match(sql, new RegExp(`'${name}'`));
  }
  assert.match(sql, /ghostlinks_profiles/);
  assert.match(sql, /ghostlinks_reserved_usernames/);
  assert.match(sql, /ghostlinks_username_available/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.doesNotMatch(sql, /service_role/);
  assert.doesNotMatch(sql, /create table public\.profiles\b/i);
  assert.doesNotMatch(sql, /alter table public\.profiles\b/i);
  assert.doesNotMatch(sql, /drop table/i);
});

test("Discord redirect follows the project-site base path", () => {
  assert.equal(
    editorRedirectUrl("https://ghostfacemodz.github.io", "/ghostlinks/", "ghostfacemodz.github.io"),
    "https://ghostfacemodz.github.io/ghostlinks/editor.html"
  );
  assert.equal(
    editorRedirectUrl("https://ghostfacemodz.github.io", "/ghostlinks/index.html", "ghostfacemodz.github.io"),
    "https://ghostfacemodz.github.io/ghostlinks/editor.html"
  );
  assert.equal(
    editorRedirectUrl("https://ghostapps.org", "/editor.html", "ghostapps.org"),
    "https://ghostapps.org/editor.html"
  );
  assert.equal(
    editorRedirectUrl("http://127.0.0.1:8080", "/", "127.0.0.1"),
    "http://127.0.0.1:8080/editor.html"
  );
});

test("youtube and link parsing stay strict", () => {
  assert.equal(parseYouTubeId("8xdmFpNb8EI"), "8xdmFpNb8EI");
  assert.equal(parseYouTubeId("https://www.youtube.com/watch?v=8xdmFpNb8EI"), "8xdmFpNb8EI");
  assert.equal(parseYouTubeId("https://youtu.be/DZrG_Cjx1L8?t=4"), "DZrG_Cjx1L8");
  assert.equal(parseYouTubeId("https://music.youtube.com/watch?v=oblsGyGuoIY"), "oblsGyGuoIY");
  assert.equal(parseYouTubeId("https://www.youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  assert.equal(parseYouTubeId("javascript:alert(1)"), "");
  assert.equal(safeHttps("javascript:alert(1)"), "");
  assert.equal(safeHttps("http://example.com"), "");
  assert.equal(safeHttps("https://user:pass@example.com"), "");
  assert.equal(safeHttps("https://ghostflix.uk"), "https://ghostflix.uk/");
  assert.equal(platformFromUrl("https://discord.gg/example"), "discord");
  assert.equal(platformFromUrl("https://x.com/ghost"), "x");
  assert.equal(platformFromUrl("https://www.tiktok.com/@ghost"), "tiktok");
  assert.equal(platformFromUrl("https://open.spotify.com/track/abc"), "spotify");
  assert.equal(platformFromUrl("https://ghostflix.uk"), "custom");
  assert.equal(safeAvatar("https://cdn.example/a.png"), "https://cdn.example/a.png");
  assert.equal(safeAvatar("data:text/html;base64,aaaa"), "");
});

test("the built-in demo keeps its reserved username", () => {
  const demo = demoProfile();
  assert.equal(demo.username, "demo");
  assert.equal(demo.displayName, "GhostLink");
  assert.equal(profileIssues({ username: "demo", displayName: "Ghost" }).some((issue) => issue.field === "username"), true);
});

test("profiles clamp links and tracks", () => {
  const links = Array.from({ length: 12 }, (_, index) => ({ url: `https://example.com/${index}`, label: "x".repeat(80) }));
  const profile = normalizeProfile({
    username: "Nova",
    displayName: "N",
    links,
    tracks: [
      { url: "https://www.youtube.com/watch?v=8xdmFpNb8EI", title: "One" },
      { id: "not-an-id" },
      { id: "8xdmFpNb8EI" }
    ],
    accent: "red"
  });
  assert.equal(profile.username, "nova");
  assert.equal(profile.links.length, 10);
  assert.equal(profile.links[0].label.length <= 32, true);
  assert.equal(profile.tracks.length, 1);
  assert.equal(profile.accent, "#8f6cff");
  const issues = profileIssues({ username: "ab", displayName: "", links: [{ url: "http://nope" }], tracks: [{ url: "nope" }] });
  assert.ok(issues.length >= 3);
});

test("pretty paths become query routes", () => {
  assert.equal(prettyPathRedirect("/zane", "ghostapps.org"), "/?u=zane");
  assert.equal(prettyPathRedirect("/GhostFace/", "ghostapps.org"), "/?u=ghostface");
  assert.equal(prettyPathRedirect("/editor", "ghostapps.org"), "/?page=editor");
  assert.equal(prettyPathRedirect("/ghostlinks/nova", "ghost.github.io"), "/ghostlinks/?u=nova");
  assert.equal(prettyPathRedirect("/ghostlinks/editor", "ghost.github.io"), "/ghostlinks/?page=editor");
  assert.equal(prettyPathRedirect("/nova", "ghost.github.io"), "/?u=nova");
  assert.equal(prettyPathRedirect("/assets/missing.png", "ghostapps.org"), null);
});

test("empty config stays in demo mode and service-role keys are recognised", () => {
  assert.equal(isDemoMode({ url: "", key: "" }), true);
  assert.equal(isDemoMode({ url: "https://YOUR_PROJECT.supabase.co", key: "YOUR_ANON_KEY" }), true);
  assert.equal(isDemoMode({ url: "https://abc.supabase.co", key: "anon-key" }), false);
  const body = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  assert.equal(keyLooksLikeServiceRole(`aaa.${body}.sig`), true);
  assert.equal(keyLooksLikeServiceRole("sb_publishable_example"), false);
});
