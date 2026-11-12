import { expect, test } from "@playwright/test";
import { appUrl, attachConsole, baseURL, shot } from "../helpers.js";

test.describe("GhostLinks smoke", () => {
  test("landing loads with no console errors", async ({ page }) => {
    const errors = attachConsole(page);
    const res = await page.goto(appUrl("./"), { waitUntil: "domcontentloaded" });
    expect(res, "landing should respond").toBeTruthy();
    expect(res.status(), "landing HTTP status").toBe(200);
    await expect(page.getByRole("link", { name: "GhostLinks home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create your page" })).toBeVisible();
    await expect(page.locator("main.land#content")).toBeVisible();
    await shot(page, "landing");
    expect(errors, `console errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("editor shows the sign-in card", async ({ page }) => {
    const errors = attachConsole(page);
    const res = await page.goto(appUrl("editor.html"), { waitUntil: "domcontentloaded" });
    expect(res, "editor should respond").toBeTruthy();
    expect(res.status(), "editor HTTP status").toBe(200);
    const card = page.locator(".notice-card");
    await expect(card.getByRole("heading", { name: "Sign in to build your page" })).toBeVisible({ timeout: 20_000 });
    await expect(card.getByRole("button", { name: "Sign in with Discord" })).toBeVisible();
    await shot(page, "editor-signin");
    const unexpected = errors.filter((msg) => !/Failed to load resource/i.test(msg));
    expect(unexpected, `console errors: ${unexpected.join("\n")}`).toEqual([]);
  });

  test("demo enter screen, click reveals the page, and links render", async ({ page }) => {
    const errors = attachConsole(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const res = await page.goto(appUrl("?u=demo"), { waitUntil: "domcontentloaded" });
    expect(res, "demo should respond").toBeTruthy();
    expect(res.status(), "demo HTTP status").toBe(200);
    const enter = page.locator("button.enter-button");
    await expect(enter).toBeVisible({ timeout: 20_000 });
    await expect(enter).toContainText(/click to enter/i);
    await shot(page, "demo-enter");

    await enter.click();
    await expect(page.locator(".gl-page")).toHaveClass(/is-in/, { timeout: 10_000 });
    await expect(page.locator(".experience .profile-name")).toBeVisible();
    const links = page.locator(".socials a");
    await expect(links.first()).toBeVisible();
    const count = await links.count();
    expect(count, "demo should render at least one profile link").toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(links.nth(i)).toHaveAttribute("href", /https?:\/\//);
    }
    await shot(page, "demo-page");
    const unexpected = errors.filter((msg) => !/Failed to load resource/i.test(msg));
    expect(unexpected, `console errors: ${unexpected.join("\n")}`).toEqual([]);
  });

  test("/demo redirects to ?u=demo", async ({ page }) => {
    await page.goto(appUrl("demo"), { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.searchParams.get("u") === "demo", { timeout: 15_000 });
    const dest = new URL(page.url());
    const base = new URL(baseURL());
    expect(dest.pathname.replace(/\/$/, "")).toBe(base.pathname.replace(/\/$/, ""));
    await expect(page.locator("button.enter-button")).toBeVisible({ timeout: 20_000 });
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
    for (const item of items) {
      expect(item.file, `${item.id || "entry"} should have a file`).toBeTruthy();
      const res = await request.get(appUrl(`assets/splash/${item.file}`));
      if (res.status() !== 200) failures.push(`${item.file} → ${res.status()}`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
