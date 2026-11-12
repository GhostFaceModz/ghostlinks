/**
 * Playwright globalSetup: before testing the live site, wait until GitHub Pages
 * is actually serving the commit under test (EXPECT_SHA), so CI never tests the
 * previous build.
 *
 * Two independent checks, both with a timeout (DEPLOY_TIMEOUT_MS, default 10 min):
 *  1. Pages API (needs GITHUB_TOKEN + GITHUB_REPOSITORY, `pages: read`):
 *     /pages/builds/latest must be "built" for EXPECT_SHA, or for a newer commit
 *     that contains it (then the newer build is tested and step 2 is skipped).
 *  2. Content: cache-busted fetches of the site's own files (HTML, config, JS, CSS,
 *     splash manifest) must be byte-identical to the checkout. This proves the CDN
 *     edge is serving this commit, not just that the build finished.
 *
 * No-op when EXPECT_SHA is unset (local runs) or the base URL is local.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baseURL, isLocal } from "./helpers/env.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (msg) => console.log(`[wait-for-deploy] ${msg}`);

function siteFiles() {
  const files = ["index.html", "editor.html", "404.html", "config.js", "assets/splash/manifest.json"];
  for (const folder of ["js", "css"]) {
    const abs = path.join(repoRoot, folder);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs).sort()) {
      if (/\.(js|css)$/.test(name)) files.push(`${folder}/${name}`);
    }
  }
  return files.filter((file) => fs.existsSync(path.join(repoRoot, file)));
}

const hash = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

async function github(pathname) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${pathname} → ${res.status}`);
  return res.json();
}

/** Returns "exact", "newer", or null (not deployed yet). */
async function pagesBuildState(repo, sha) {
  const build = await github(`/repos/${repo}/pages/builds/latest`);
  if (build.status !== "built" || !build.commit) {
    log(`Pages build for ${String(build.commit).slice(0, 7)} is "${build.status}"`);
    return null;
  }
  if (build.commit === sha) return "exact";
  const cmp = await github(`/repos/${repo}/compare/${sha}...${build.commit}`);
  if (cmp.status === "ahead" || cmp.status === "identical") {
    log(`Pages already serves a newer commit ${build.commit.slice(0, 7)} that contains ${sha.slice(0, 7)}`);
    return "newer";
  }
  log(`Pages serves ${build.commit.slice(0, 7)} (${cmp.status} of ${sha.slice(0, 7)}), waiting`);
  return null;
}

async function contentMismatches(base, files) {
  const bust = `e2e=${Date.now()}`;
  const wrong = [];
  await Promise.all(
    files.map(async (file) => {
      const local = hash(fs.readFileSync(path.join(repoRoot, file)));
      try {
        const res = await fetch(`${new URL(file, base).href}?${bust}`, { cache: "no-store", headers: { "cache-control": "no-cache" } });
        if (!res.ok) return wrong.push(`${file} (${res.status})`);
        const live = hash(Buffer.from(await res.arrayBuffer()));
        if (live !== local) wrong.push(file);
      } catch (error) {
        wrong.push(`${file} (${error.message})`);
      }
    })
  );
  return wrong.sort();
}

export default async function waitForDeploy() {
  const sha = (process.env.EXPECT_SHA || "").trim();
  if (!sha || isLocal()) return;
  const base = baseURL();
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(base)) return;
  const timeout = Number(process.env.DEPLOY_TIMEOUT_MS || 600_000);
  const deadline = Date.now() + timeout;
  const repo = process.env.GITHUB_REPOSITORY;
  log(`waiting for ${base} to serve ${sha.slice(0, 7)} (timeout ${Math.round(timeout / 1000)}s)`);

  let skipContent = false;
  if (repo && process.env.GITHUB_TOKEN) {
    for (;;) {
      let state = null;
      try {
        state = await pagesBuildState(repo, sha);
      } catch (error) {
        log(`Pages API check failed (${error.message}); relying on the content check`);
        break;
      }
      if (state) {
        skipContent = state === "newer";
        log(`Pages build is ready (${state})`);
        break;
      }
      if (Date.now() > deadline) throw new Error(`Timed out waiting for the Pages build of ${sha}`);
      await sleep(10_000);
    }
  }
  if (skipContent) return;

  const files = siteFiles();
  for (;;) {
    const wrong = await contentMismatches(base, files);
    if (!wrong.length) {
      log(`live site matches the checkout for ${files.length} files`);
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out: live site still differs from ${sha.slice(0, 7)} in: ${wrong.join(", ")}`);
    }
    log(`${wrong.length} file(s) not deployed yet: ${wrong.slice(0, 5).join(", ")}${wrong.length > 5 ? "…" : ""}`);
    await sleep(10_000);
  }
}
