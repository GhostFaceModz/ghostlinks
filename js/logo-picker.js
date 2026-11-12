/** Ghost mark picker. Only files named in assets/brand/ghosts/manifest.json are requested. */

import { el } from "./dom.js";
import { normalizeLogoImage } from "./looks.js";
import { bindRadioGroup } from "./radios.js";
import { siteBase } from "./route.js";
import { compressSplashFile } from "./splash-gallery.js";

const LOGO_FILE = /^ghost-[a-z0-9_-]{1,40}\.png$/;

export async function loadGhostManifest() {
  try {
    const response = await fetch(`${siteBase()}assets/brand/ghosts/manifest.json`, { cache: "no-cache" });
    if (!response.ok) return [];
    const data = await response.json();
    const images = Array.isArray(data) ? data : [];
    return images.filter((item) => item && LOGO_FILE.test(item.file));
  } catch {
    return [];
  }
}

export function logoPresetPath(file) {
  return LOGO_FILE.test(file) ? `assets/brand/ghosts/${file}` : "";
}

export async function mountLogoPicker(container, profile, onChange, onError) {
  container.replaceChildren(el("p", { class: "ed-hint" }, "Loading ghost marks…"));
  const images = await loadGhostManifest();
  const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", id: "logo-file", class: "ed-file" });
  const note = el("p", { class: "ed-hint" });
  const grid = el("div", { class: "logo-presets", role: "radiogroup", "aria-label": "Ghost mark" });
  const current = normalizeLogoImage(profile.settings?.logo_image);

  function choose(value) {
    const clean = value ? normalizeLogoImage(value) : "";
    if (value && !clean) {
      onError("That logo is too large to save. Keep GIFs under 130 KB.");
      return;
    }
    onChange(clean);
    grid.querySelectorAll(".logo-preset").forEach((node) => {
      const on = node.dataset.path === clean;
      node.setAttribute("aria-checked", on ? "true" : "false");
      node.tabIndex = on ? 0 : -1;
    });
  }

  const builtin = el("button", {
    type: "button",
    class: "logo-preset",
    role: "radio",
    "data-path": "",
    "aria-checked": String(!current)
  }, "Default");
  builtin.addEventListener("click", () => choose(""));
  grid.append(builtin);

  for (const item of images) {
    const path = logoPresetPath(item.file);
    if (!path) continue;
    const button = el("button", {
      type: "button",
      class: "logo-preset",
      role: "radio",
      "data-path": path,
      "aria-checked": String(current === path)
    }, [
      el("img", { alt: "", src: `${siteBase()}${path}`, width: "96", height: "96", decoding: "async" }),
      el("span", {}, item.label || item.id || item.file)
    ]);
    button.querySelector("img").addEventListener("error", () => button.querySelector("img").hidden = true);
    button.addEventListener("click", () => choose(path));
    grid.append(button);
  }
  if (!images.length) note.textContent = "Ghost marks are not in this folder yet. You can still upload your own.";

  file.addEventListener("change", async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    try {
      const data = await compressSplashFile(chosen);
      choose(data);
      note.textContent = "Custom logo added. It stays transparent and glows with your accent.";
    } catch (error) {
      onError(error.message || "Couldn't use that logo.");
    }
  });

  bindRadioGroup(grid);
  container.replaceChildren(
    el("label", { class: "ed-file-label", for: "logo-file" }, "Upload a logo"),
    file,
    note,
    grid
  );
}
