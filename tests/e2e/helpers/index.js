import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import { baseURL } from "./env.js";

export { baseURL } from "./env.js";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const YOUTUBE_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com)$/i;
export const SUPABASE_URL = /supabase\.co|@supabase\/|supabase-js/i;

/** Resolve a path against the app base (not the github.io origin root). */
export function appUrl(pathname = "") {
  return new URL(String(pathname).replace(/^\//, ""), baseURL()).href;
}

export function appOrigin() {
  return new URL(baseURL()).origin;
}

export function isSameOrigin(url) {
  try {
    return new URL(url).origin === appOrigin();
  } catch {
    return false;
  }
}

/**
 * Collects page errors, console errors, and network problems.
 * - Same-origin responses with status >= 400 and same-origin request failures fail the test.
 * - Third-party >= 400 / failures are logged as annotations (CDNs and YouTube are outside
 *   this repo's control and would make CI flaky), but never hidden.
 * - Chrome's console "Failed to load resource" lines are skipped because the network
 *   listener above already reports the same thing with the URL and status.
 */
export function watchPage(page) {
  const errors = [];
  const badSameOrigin = [];
  const thirdParty = [];
  const requests = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (/^Failed to load resource/i.test(msg.text())) return;
    errors.push(`console: ${msg.text()}`);
  });
  page.on("request", (req) => requests.push(req.url()));
  page.on("response", (res) => {
    if (res.status() < 400) return;
    const line = `${res.status()} ${res.request().method()} ${res.url()}`;
    if (isSameOrigin(res.url())) badSameOrigin.push(line);
    else thirdParty.push(line);
  });
  page.on("requestfailed", (req) => {
    const reason = req.failure()?.errorText || "failed";
    // Aborted requests are normal (navigations, media range requests, closed pages).
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(reason)) return;
    const line = `${reason} ${req.method()} ${req.url()}`;
    if (isSameOrigin(req.url())) badSameOrigin.push(line);
    else thirdParty.push(line);
  });
  return {
    errors,
    badSameOrigin,
    thirdParty,
    requests,
    /** Call at the end of a test. */
    assertClean() {
      const info = test.info();
      for (const line of thirdParty) info.annotations.push({ type: "third-party-error", description: line });
      if (thirdParty.length) console.warn(`[${info.title}] third-party network errors:\n  ${thirdParty.join("\n  ")}`);
      if (badSameOrigin.length || errors.length) {
        throw new Error(
          [
            badSameOrigin.length ? `Same-origin network errors:\n  ${badSameOrigin.join("\n  ")}` : "",
            errors.length ? `Page/console errors:\n  ${errors.join("\n  ")}` : "",
          ].filter(Boolean).join("\n")
        );
      }
    },
  };
}

/** Serve config.js with empty Supabase values so the app runs in demo mode (localStorage only). */
export async function useDemoMode(page) {
  await page.route(/\/config\.js(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript; charset=utf-8",
      body: 'window.GHOSTLINKS_CONFIG = { supabaseUrl: "", supabaseAnonKey: "" };',
    })
  );
}

/**
 * Scroll width vs the layout viewport width.
 * With isMobile emulation (like a real phone) window.innerWidth GROWS to fit
 * overflowing content (414 on a 390 screen), so it can't be the yardstick.
 * documentElement.clientWidth stays at the device-width layout viewport (390).
 */
export async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const scroller = document.scrollingElement || document.documentElement;
    return {
      scrollWidth: scroller.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      innerWidth: window.innerWidth,
    };
  });
}

export async function shot(page, name) {
  const info = test.info();
  const file = path.join(dir, "artifacts", `${info.project.name}-${name}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
  await info.attach(`${info.project.name}-${name}`, { path: file, contentType: "image/png" });
  return file;
}
