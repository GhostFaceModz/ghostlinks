/** Entrance image: a preset from assets/splash/manifest.json, or a compressed upload. */

import { el } from "./dom.js";
import { siteBase } from "./route.js";

const MAX_DATA = 160000;

export async function loadSplashManifest() {
  try {
    const response = await fetch(`${siteBase()}assets/splash/manifest.json`, { cache: "no-cache" });
    if (!response.ok) return [];
    const data = await response.json();
    const images = Array.isArray(data) ? data : (Array.isArray(data.images) ? data.images : []);
    return images.filter((item) => item && /^splash-(0[1-9]|1[0-9]|20)\.webp$/.test(item.file));
  } catch {
    return [];
  }
}

export function presetPath(file) {
  return `assets/splash/${file}`;
}

export function compressSplashFile(file) {
  if (file.type === "image/gif") {
    if (file.size > 200000) return Promise.reject(new Error("GIFs need to be under 200 KB so the page stays fast."));
    return readFile(file);
  }
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    return Promise.reject(new Error("Use a PNG, JPEG, WebP, or GIF."));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 960 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Couldn't read that image."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL("image/webp", 0.72);
      if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/jpeg", 0.72);
      if (data.length > MAX_DATA) data = canvas.toDataURL("image/jpeg", 0.5);
      if (data.length > MAX_DATA) {
        reject(new Error("That image is still too large after compressing. Try a smaller one."));
        return;
      }
      resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    image.src = url;
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(file);
  });
}

export async function mountSplashGallery(container, profile, onChange, onError) {
  container.replaceChildren(el("p", { class: "ed-hint" }, "Loading gallery…"));
  const images = await loadSplashManifest();
  const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", id: "splash-file", class: "ed-file" });
  const note = el("p", { class: "ed-hint", id: "splash-note" });
  const grid = el("div", { class: "splash-presets", role: "listbox", "aria-label": "Preset entrance images" });
  const none = presetButton("None", "", !profile.settings.splash_image);
  none.addEventListener("click", () => choose(""));
  grid.append(none);
  if (!images.length) {
    note.textContent = "Preset images are not in this folder yet. You can still upload your own.";
  }
  for (const item of images) {
    const path = presetPath(item.file);
    const button = presetButton(item.name || item.label || item.file, path, profile.settings.splash_image === path);
    if (Array.isArray(item.tags) && item.tags.length) button.title = item.tags.slice(0, 4).join(" · ");
    const img = el("img", { alt: "", src: `${siteBase()}${path}` });
    const fallback = el("span", { class: "preset-fallback", "aria-hidden": "true" });
    img.addEventListener("error", () => { img.hidden = true; });
    button.prepend(fallback, img);
    button.addEventListener("click", () => choose(path));
    grid.append(button);
  }
  file.addEventListener("change", async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    try {
      const data = await compressSplashFile(chosen);
      choose(data);
      note.textContent = "Custom image added. Save the page to keep it.";
    } catch (error) {
      onError(error.message || "Couldn't use that image.");
    }
  });
  function choose(value) {
    onChange(value);
    grid.querySelectorAll(".splash-preset").forEach((node) => {
      node.setAttribute("aria-selected", String(node.dataset.path === value));
    });
  }
  container.replaceChildren(
    el("label", { class: "ed-file-label", for: "splash-file" }, "Upload an image or GIF"),
    file,
    note,
    grid
  );
}

function presetButton(label, path, selected) {
  return el("button", {
    type: "button",
    class: "splash-preset",
    role: "option",
    "data-path": path,
    "aria-selected": String(selected)
  }, [el("span", {}, label)]);
}
