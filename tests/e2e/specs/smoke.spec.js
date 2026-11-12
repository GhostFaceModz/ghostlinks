import { expect, test } from "@playwright/test";
import { appUrl, baseURL, shot, watchPage } from "../helpers/index.js";

test.describe("GhostLinks smoke", () => {
  test("landing loads with no errors", async ({ page }) => {
    const watch = watchPage(page);
    const res = await page.goto(appUrl("./"), { waitUntil: "load" });
    expect(res, "landing should respond").toBeTruthy();
    expect(res.status(), "landing HTTP status").toBe(200);
    await expect(page.getByRole("link", { name: "GhostLinks home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create your page" })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, "landing");
    watch.assertClean();
  });

  test("editor shows the sign-in card", async ({ page }) => {
    const watch = watchPage(page);
    const res = await page.goto(appUrl("editor.html"), { waitUntil: "load" });
    expect(res, "editor should respond").toBeTruthy();
    expect(res.status(), "editor HTTP status").toBe(200);
    const card = page.getByRole("main");
    await expect(card.getByRole("heading", { name: "Sign in to build your page" })).toBeVisible({ timeout: 20_000 });
    await expect(card.getByRole("button", { name: "Sign in with Discord" })).toBeVisible();
    await shot(page, "editor-signin");
    watch.assertClean();
  });

  test("demo enter screen, click reveals the page, and links render", async ({ page }) => {
    const watch = watchPage(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const res = await page.goto(appUrl("?u=demo"), { waitUntil: "domcontentloaded" });
    expect(res, "demo should respond").toBeTruthy();
    expect(res.status(), "demo HTTP status").toBe(200);
    const enter = page.getByRole("button", { name: /click to enter/i });
    await expect(enter).toBeVisible({ timeout: 20_000 });
    await shot(page, "demo-enter");

    await enter.click();
    await expect(page.locator(".gl-page")).toHaveClass(/is-in/, { timeout: 10_000 });
    await expect(page.locator(".experience .profile-name")).toBeVisible();
    const links = page.getByRole("navigation", { name: "Links" }).getByRole("link");
    await expect(links.first()).toBeVisible();
    const count = await links.count();
    expect(count, "demo should render at least one profile link").toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(links.nth(i)).toHaveAttribute("href", /https?:\/\//);
    }
    await shot(page, "demo-page");
    watch.assertClean();
  });

  test("/demo redirects to ?u=demo", async ({ page }) => {
    // /demo itself is a 404 that serves 404.html (GitHub Pages behaviour), so no watchPage here.
    await page.goto(appUrl("demo"), { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.searchParams.get("u") === "demo", { timeout: 15_000 });
    const dest = new URL(page.url());
    const base = new URL(baseURL());
    expect(dest.pathname.replace(/\/$/, "")).toBe(base.pathname.replace(/\/$/, ""));
    await expect(page.getByRole("button", { name: /click to enter/i })).toBeVisible({ timeout: 20_000 });
    await shot(page, "demo-redirect");
  });

  test("every manifest splash image returns 200", async ({ request }) => {
    test.skip(test.info().project.name !== "desktop", "HTTP checks only need to run once");
    const manifestRes = await request.get(appUrl("assets/splash/manifest.json"));
    expect(manifestRes.status(), "manifest.json").toBe(200);
    const items = await manifestRes.json();
    expect(Array.isArray(items), "manifest should be an array").toBe(true);
    expect(items.length, "manifest should list splash images").toBeGreaterThanOrEqual(20);
    const failures = [];
    await Promise.all(
      items.map(async (item) => {
        expect(item.file, `${item.id || "entry"} should have a file`).toBeTruthy();
        const res = await request.get(appUrl(`assets/splash/${item.file}`));
        if (res.status() !== 200) failures.push(`${item.file} → ${res.status()}`);
      })
    );
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
