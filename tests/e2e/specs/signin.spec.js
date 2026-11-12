import { expect, test } from "@playwright/test";
import { appUrl } from "../helpers/index.js";

test("each sign-in button starts the right provider", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "provider redirects only need one browser");
  await page.goto(appUrl("editor.html"), { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Sign in to build your page" })).toBeVisible({ timeout: 20_000 });

  await expect(page.locator("[data-provider=facebook]")).toBeHidden();

  for (const provider of ["google", "discord", "twitch"]) {
    const pending = page.waitForRequest((request) => {
      if (!request.url().includes("/auth/v1/authorize")) return false;
      return new URL(request.url()).searchParams.get("provider") === provider;
    });
    await page.getByRole("button", { name: new RegExp(`continue with ${provider}`, "i") }).click();
    const request = await pending;
    const redirect = new URL(request.url()).searchParams.get("redirect_to") || "";
    expect(decodeURIComponent(redirect)).toMatch(/editor\.html$/);
    await page.goto(appUrl("editor.html"), { waitUntil: "load" });
  }

  await page.route("**/auth/v1/otp**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "{}"
  }));
  const otp = page.waitForRequest((request) => request.url().includes("/auth/v1/otp") && request.method() === "POST");
  await page.locator("#magic-email").fill("reader@example.com");
  await page.getByRole("button", { name: "Email me a magic link" }).click();
  const sent = await otp;
  const body = sent.postDataJSON();
  expect(body.email).toBe("reader@example.com");
  const redirect = new URL(sent.url()).searchParams.get("redirect_to") || body.email_redirect_to || "";
  expect(decodeURIComponent(String(redirect))).toMatch(/editor\.html$/);
});

test("facebook sign-in starts when FACEBOOK_ENABLED is true", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "provider redirects only need one browser");
  await page.route("**/config.js", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace("FACEBOOK_ENABLED: false", "FACEBOOK_ENABLED: true");
    await route.fulfill({ status: 200, contentType: "application/javascript", body });
  });
  await page.goto(appUrl("editor.html"), { waitUntil: "load" });
  const pending = page.waitForRequest((request) => {
    if (!request.url().includes("/auth/v1/authorize")) return false;
    return new URL(request.url()).searchParams.get("provider") === "facebook";
  });
  await page.getByRole("button", { name: /continue with facebook/i }).click();
  const request = await pending;
  const redirect = new URL(request.url()).searchParams.get("redirect_to") || "";
  expect(decodeURIComponent(redirect)).toMatch(/editor\.html$/);
});
