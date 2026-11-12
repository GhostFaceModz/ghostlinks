/*
 * Checks for the QA findings from the GhostLinks round-2 audit.
 * The bugs those checks covered are fixed, so the specs now expect a pass.
 */
import { expect, test } from "@playwright/test";
import {
  appUrl,
  horizontalOverflow,
  SUPABASE_URL,
  useDemoMode,
  watchPage,
  YOUTUBE_HOSTS,
} from "../helpers/index.js";
import { imageSize } from "../helpers/image-size.js";

const SPLASH_MAX_BYTES = 300 * 1024;

const isYouTube = (url) => {
  try {
    return YOUTUBE_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

test.describe("phone layout fits a 390px screen", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "phone", "phone-only layout check");
  });

  test("landing has no horizontal overflow", async ({ page }) => {
    await page.goto(appUrl("./"), { waitUntil: "load" });
    const { scrollWidth, viewportWidth } = await horizontalOverflow(page);
    expect(scrollWidth, `landing scrollWidth ${scrollWidth} vs viewport ${viewportWidth}`).toBeLessThanOrEqual(viewportWidth);
  });

  test("editor sign-in card has no horizontal overflow", async ({ page }) => {
    await page.goto(appUrl("editor.html"), { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "Sign in to build your page" })).toBeVisible({ timeout: 20_000 });
    const { scrollWidth, viewportWidth } = await horizontalOverflow(page);
    expect(scrollWidth, `editor scrollWidth ${scrollWidth} vs viewport ${viewportWidth}`).toBeLessThanOrEqual(viewportWidth);
  });

  test("editor form (demo mode) has no horizontal overflow", async ({ page }) => {
    await useDemoMode(page);
    await page.goto(appUrl("editor.html"), { waitUntil: "load" });
    await expect(page.locator(".splash-presets")).toBeVisible({ timeout: 20_000 });
    const { scrollWidth, viewportWidth } = await horizontalOverflow(page);
    expect(scrollWidth, `editor form scrollWidth ${scrollWidth} vs viewport ${viewportWidth}`).toBeLessThanOrEqual(viewportWidth);
  });

  test("?u=demo has no horizontal overflow before and after enter", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(appUrl("?u=demo"), { waitUntil: "load" });
    const enter = page.getByRole("button", { name: /click to enter/i });
    await expect(enter).toBeVisible({ timeout: 20_000 });
    const before = await horizontalOverflow(page);
    expect(before.scrollWidth, `enter screen scrollWidth ${before.scrollWidth}`).toBeLessThanOrEqual(before.viewportWidth);
    await enter.click();
    await expect(page.locator(".gl-page")).toHaveClass(/is-in/, { timeout: 10_000 });
    const after = await horizontalOverflow(page);
    expect(after.scrollWidth, `profile scrollWidth ${after.scrollWidth}`).toBeLessThanOrEqual(after.viewportWidth);
  });
});

test.describe("third-party loading", () => {
  test("?u=demo makes no YouTube player requests before the enter click", async ({ page }) => {
    const watch = watchPage(page);
    await page.goto(appUrl("?u=demo"), { waitUntil: "load" });
    await expect(page.getByRole("button", { name: /click to enter/i })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    const yt = watch.requests.filter(isYouTube).filter((url) => !/ytimg\.com/i.test(url));
    expect(yt, `YouTube player requests before enter:\n${yt.join("\n")}`).toEqual([]);
  });

  test("?u=demo loads no YouTube thumbnails (ytimg) before the enter click", async ({ page }) => {
    const watch = watchPage(page);
    await page.goto(appUrl("?u=demo"), { waitUntil: "load" });
    await expect(page.getByRole("button", { name: /click to enter/i })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    const yt = watch.requests.filter((url) => /ytimg\.com/i.test(url));
    expect(yt, `ytimg requests before enter:\n${yt.join("\n")}`).toEqual([]);
  });

  test("landing page makes no Supabase requests", async ({ page }) => {
    const watch = watchPage(page);
    await page.goto(appUrl("./"), { waitUntil: "load" });
    await page.waitForTimeout(1000);
    const supa = watch.requests.filter((url) => SUPABASE_URL.test(url));
    expect(supa, `Supabase requests on the landing page:\n${supa.join("\n")}`).toEqual([]);
  });

  test("?u=demo makes no Supabase requests before the enter click", async ({ page }) => {
    const watch = watchPage(page);
    await page.goto(appUrl("?u=demo"), { waitUntil: "load" });
    await expect(page.getByRole("button", { name: /click to enter/i })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1000);
    const supa = watch.requests.filter((url) => SUPABASE_URL.test(url));
    expect(supa, `Supabase requests before enter:\n${supa.join("\n")}`).toEqual([]);
  });
});

test.describe("images", () => {
  test("editor splash gallery images are lazy (not all fetched on open)", async ({ page }) => {
    const watch = watchPage(page);
    await useDemoMode(page);
    await page.goto(appUrl("editor.html"), { waitUntil: "load" });
    const imgs = page.locator(".splash-presets img");
    await expect(imgs.first()).toBeAttached({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    const total = await imgs.count();
    const notLazy = await imgs.evaluateAll((nodes) =>
      nodes.filter((img) => img.getAttribute("loading") !== "lazy").map((img) => img.getAttribute("src"))
    );
    const fetched = new Set(watch.requests.filter((url) => /\/assets\/splash\/[^/]+\.(webp|png|jpe?g|gif|avif)/i.test(url)).map((u) => new URL(u).pathname));
    // Pass if every image is loading="lazy", or if fewer than all were fetched on open.
    expect(
      notLazy.length === 0 || fetched.size < total,
      `${notLazy.length}/${total} gallery images lack loading="lazy" and ${fetched.size}/${total} were fetched on open`
    ).toBe(true);
  });

  test("each assets/splash image is under 300 KB", async ({ request }) => {
    test.skip(test.info().project.name !== "desktop", "HTTP checks only need to run once");
    const items = await (await request.get(appUrl("assets/splash/manifest.json"))).json();
    const big = [];
    await Promise.all(
      items.map(async (item) => {
        const res = await request.get(appUrl(`assets/splash/${item.file}`));
        const bytes = (await res.body()).length;
        if (bytes >= SPLASH_MAX_BYTES) big.push(`${item.file}: ${Math.round(bytes / 1024)} KB`);
      })
    );
    big.sort();
    expect(big, `splash images >= 300 KB:\n${big.join("\n")}`).toEqual([]);
  });

  test("each manifest splash image is at most 1920px wide and under 250 KB", async ({ request }) => {
    test.skip(test.info().project.name !== "desktop", "HTTP checks only need to run once");
    const MAX_WIDTH = 1920;
    const MAX_BYTES = 250 * 1024;
    const items = await (await request.get(appUrl("assets/splash/manifest.json"))).json();
    const bad = [];
    await Promise.all(
      items.map(async (item) => {
        const res = await request.get(appUrl(`assets/splash/${item.file}`));
        const body = await res.body();
        const size = imageSize(body);
        const bits = [];
        if (!size) bits.push("unreadable image header");
        else if (size.width > MAX_WIDTH) bits.push(`${size.width}x${size.height}`);
        if (body.length >= MAX_BYTES) bits.push(`${Math.round(body.length / 1024)} KB`);
        if (bits.length) bad.push(`${item.file}: ${bits.join(", ")}`);
      })
    );
    bad.sort();
    expect(bad, `splash images over 1920px wide or >= 250 KB:\n${bad.join("\n")}`).toEqual([]);
  });
});

test.describe("copy", () => {
  test("visit counter says '1 visit' (singular) on a first visit", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(appUrl("?u=demo"), { waitUntil: "load" });
    const enter = page.getByRole("button", { name: /click to enter/i });
    await expect(enter).toBeVisible({ timeout: 20_000 });
    await enter.click();
    const views = page.locator(".views");
    await expect(views).toContainText(/\b1\b/);
    const text = (await views.innerText()).replace(/\s+/g, " ").trim();
    expect(text, `visit counter text: "${text}"`).toMatch(/\b1 visit\b/);
    expect(text).not.toMatch(/\b1 visits\b/);
  });
});
