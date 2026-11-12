import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";

const dir = path.dirname(fileURLToPath(import.meta.url));

export function baseURL() {
  const raw = process.env.BASE_URL || "https://ghostfacemodz.github.io/ghostlinks/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/** Resolve a path against the app base (not the github.io origin root). */
export function appUrl(pathname = "") {
  return new URL(String(pathname).replace(/^\//, ""), baseURL()).href;
}

export function attachConsole(page) {
  const errors = [];
  page.on("pageerror", (err) => {
    errors.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

export async function shot(page, name) {
  const info = test.info();
  const file = path.join(dir, "artifacts", `${info.project.name}-${name}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
  await info.attach(`${info.project.name}-${name}`, { path: file, contentType: "image/png" });
  return file;
}
