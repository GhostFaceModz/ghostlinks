/*
 * Text contrast guard (WCAG AA, 4.5:1) for the entrance overlay and the profile card,
 * measured with pixels over the lightest splash photos and backdrops.
 *
 * Why these backgrounds (relative luminance, 0 = black, 1 = white):
 *  - Splash photos, from the assets/splash/*.webp files. The entrance text sits in the
 *    middle of the screen, so we rank by the 90th-percentile luminance of the centre 50%:
 *      splash-20 Black Hole         centre p90 0.684 (brightest centre, the lit accretion ring)
 *      splash-26 Pastel Dreamscape  centre p90 0.538, whole-image p90 0.427 (lightest overall)
 *      splash-15                    centre p90 0.375, whole-image p90 0.343
 *    plus two named cases from Zane's report, Golden Clouds (splash-23) and Gold Dust (splash-31):
 *    their bright areas are small, but they're the "misty / gold" looks he flagged.
 *  - Backdrops from #19, rendered still (reduced motion) and sampled behind the card box:
 *      lava    p90 0.329 at 1440, 0.210 at 390  (lightest)
 *      aurora  p90 0.133 at 1440, 0.110 at 390  (second)
 *      fog     p90 0.076 at 1440, 0.053 at 390  ("Smoke", the misty one Zane named)
 *    The other 11 backdrops are under 0.06 p90.
 *
 * Runs at 390px (iPhone 13 profile, "phone" project) and 1440px ("desktop" project, resized here).
 * Pages render in demo mode (blank config.js) from a localStorage profile, which is the same
 * mountPage() path the editor Preview uses.
 */
import { test } from "@playwright/test";
import { appUrl, useDemoMode } from "../helpers/index.js";
import { expectContrast, measureText, PROFILE_KEY, QA_USER, qaProfile, settleImages } from "../helpers/contrast.js";

const SPLASHES = ["splash-20", "splash-26", "splash-15", "splash-23", "splash-31"];
const BACKDROPS = ["lava", "aurora", "fog"];

const ENTRANCE_TEXT = [
  ["name", ".entrance .splash-name"],
  ["handle", ".entrance .splash-handle"],
  ["enter pill", ".entrance .enter-tag"],
  ["tap hint", ".entrance .enter-hint"],
];
const CARD_TEXT = [
  ["name", ".card .profile-name"],
  ["handle", ".card .handle"],
  ["bio", ".card .bio"],
];

// Known-bug list, same pattern as the other specs: a case listed here is wrapped in
// test.fail("contrast bug: flips when builder fix lands"). Key: "<project>|<case>".
// Empty: after #20 (scrim, solid pill, white name fill, opaque card) every case passes on live.
// Before #20, 16 of 22 cases failed (e.g. entrance over splash-26 at 390px: name 1.05,
// handle 1.01, pill 1.75, hint 1.13). Add a key here only for a newly found, tracked bug.
const KNOWN_LOW = new Set([]);

test.use({ reducedMotion: "reduce" });

async function open(page, profile) {
  if (test.info().project.name === "desktop") await page.setViewportSize({ width: 1440, height: 900 });
  await useDemoMode(page);
  await page.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }, [PROFILE_KEY, JSON.stringify(profile)]);
  await page.goto(appUrl(`?u=${QA_USER}`));
  await page.locator(".entrance .enter-button").waitFor({ state: "visible", timeout: 20_000 });
  await settleImages(page);
}

async function measureAll(page, items) {
  const scratch = await page.context().newPage();
  const out = [];
  try {
    for (const [label, selector] of items) {
      const nodes = page.locator(selector);
      const count = await nodes.count();
      for (let i = 0; i < count; i += 1) {
        const node = nodes.nth(i);
        if (!(await node.isVisible())) continue;
        const name = count > 1 ? `${label} ${i + 1}` : label;
        out.push({ name, ...(await measureText(page, scratch, node)) });
      }
    }
  } finally {
    await scratch.close();
  }
  return out;
}

function report(caseName, results) {
  const info = test.info();
  for (const r of results) {
    console.log(`[contrast] ${info.project.name} | ${caseName} | ${r.name} | ${r.ratio.toFixed(2)} | text ${JSON.stringify(r.text)} bg ${JSON.stringify(r.bg)} L=${r.bgLum}`);
  }
  info.annotations.push({ type: "contrast", description: JSON.stringify({ case: caseName, results }) });
}

function markKnown(caseName) {
  const key = `${test.info().project.name}|${caseName}`;
  test.fail(KNOWN_LOW.has(key), "contrast bug: flips when builder fix lands");
}

test.describe("entrance text contrast over light splashes", () => {
  for (const splash of SPLASHES) {
    test(`entrance over ${splash}`, async ({ page }) => {
      const caseName = `entrance/${splash}`;
      markKnown(caseName);
      await open(page, qaProfile({ splash, backdrop: "mist" }));
      const results = await measureAll(page, ENTRANCE_TEXT);
      report(caseName, results);
      expectContrast(results);
    });
  }
});

test.describe("entrance and card text contrast over light backdrops", () => {
  for (const backdrop of BACKDROPS) {
    test(`entrance over ${backdrop} backdrop`, async ({ page }) => {
      const caseName = `entrance/${backdrop}`;
      markKnown(caseName);
      await open(page, qaProfile({ backdrop }));
      const results = await measureAll(page, ENTRANCE_TEXT);
      report(caseName, results);
      expectContrast(results);
    });

    test(`card over ${backdrop} backdrop`, async ({ page }) => {
      const caseName = `card/${backdrop}`;
      markKnown(caseName);
      await open(page, qaProfile({ backdrop }));
      await page.locator(".entrance .enter-button").click();
      await page.locator(".card .profile-name").waitFor({ state: "visible" });
      await page.locator(".entrance.dismissed").waitFor({ state: "attached", timeout: 5_000 }).catch(() => {});
      await settleImages(page);
      const results = await measureAll(page, [...CARD_TEXT, ["link", ".card .social-label"]]);
      report(caseName, results);
      expectContrast(results);
    });
  }
});
