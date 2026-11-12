/** Optional avatar frames. The manifest may not exist yet; a missing file degrades quietly. */

import { el } from "./dom.js";
import { normalizeAvatarFrame } from "./looks.js";
import { bindRadioGroup } from "./radios.js";
import { siteBase } from "./route.js";

const FRAME_FILE = /^[a-z0-9][a-z0-9_-]{0,40}\.(png|webp)$/;

export async function loadFrameManifest() {
  try {
    const response = await fetch(`${siteBase()}assets/brand/frames/manifest.json`, { cache: "no-cache" });
    if (!response.ok) return [];
    const data = await response.json();
    const frames = Array.isArray(data) ? data : [];
    return frames.filter((item) => item && normalizeAvatarFrame(item.id) && FRAME_FILE.test(item.file));
  } catch {
    return [];
  }
}

export function frameSrc(item) {
  if (!item || !FRAME_FILE.test(item.file)) return "";
  return `${siteBase()}assets/brand/frames/${item.file}`;
}

export async function mountFramePicker(container, profile, onChange) {
  container.replaceChildren(el("p", { class: "ed-hint" }, "Loading frames…"));
  const frames = await loadFrameManifest();
  const grid = el("div", { class: "frame-presets", role: "radiogroup", "aria-label": "Avatar frame" });
  const current = normalizeAvatarFrame(profile.settings?.avatar_frame);
  const none = el("button", {
    type: "button",
    class: "choice",
    role: "radio",
    "data-value": "",
    "aria-checked": String(!current)
  }, "None");
  none.addEventListener("click", () => onChange(""));
  grid.append(none);
  for (const item of frames) {
    const id = normalizeAvatarFrame(item.id);
    const button = el("button", {
      type: "button",
      class: "choice frame-choice",
      role: "radio",
      "data-value": id,
      "aria-checked": String(current === id)
    }, [
      el("img", { alt: "", src: frameSrc(item), width: "72", height: "72", decoding: "async" }),
      el("span", {}, item.label || id)
    ]);
    button.querySelector("img").addEventListener("error", () => { button.querySelector("img").hidden = true; });
    button.addEventListener("click", () => onChange(id));
    grid.append(button);
  }
  bindRadioGroup(grid);
  const note = frames.length
    ? ""
    : "Avatar frames are not in this folder yet. The page still works without one.";
  container.replaceChildren(note ? el("p", { class: "ed-hint" }, note) : null, grid);
}
