/** Avatar picker. Ghost marks are local. Premium avatars load only if their manifest exists. */

import { el } from "./dom.js";
import { safeAvatar } from "./model.js";
import {
  GHOST_MARKS,
  defaultGhostId,
  ghostMarkPath,
  normalizeAvatarChoice,
  resolveAvatar
} from "./looks.js";
import { bindRadioGroup } from "./radios.js";
import { siteBase } from "./route.js";

const PREMIUM_FILE = /^[a-z0-9][a-z0-9_-]{0,48}\.(png|webp)$/;
const RESERVED = new Set(["upload", "discord"]);

export function discordAvatarUrl(session) {
  const identities = session?.user?.identities || [];
  const discord = identities.find((item) => item.provider === "discord");
  const fromProvider = session?.user?.app_metadata?.provider === "discord";
  if (!discord && !fromProvider) return "";
  const data = discord?.identity_data || {};
  const meta = session?.user?.user_metadata || {};
  const url = data.avatar_url || data.picture || meta.avatar_url || meta.picture || "";
  return /^https:\/\/\S+$/.test(String(url)) ? String(url) : "";
}

export function signedInWithDiscord(session) {
  const identities = session?.user?.identities || [];
  if (identities.some((item) => item.provider === "discord")) return true;
  return session?.user?.app_metadata?.provider === "discord";
}

export function loadPremiumAvatars() {
  return fetch(`${siteBase()}assets/brand/avatars/manifest.json`, { cache: "no-cache" })
    .then((response) => (response.ok ? response.json() : []))
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      return list.flatMap((item) => {
        const id = normalizeAvatarChoice(item?.id);
        if (!id || RESERVED.has(id) || ghostMarkPath(id) || !PREMIUM_FILE.test(String(item?.file || ""))) return [];
        return [{ id, label: String(item.label || id), file: String(item.file) }];
      });
    })
    .catch(() => []);
}

function absSrc(src) {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("https://") || src.startsWith("http://")) return src;
  return `${siteBase()}${src}`;
}

function stage(src, photo) {
  const img = el("img", { alt: "", src: absSrc(src) });
  img.className = photo ? "avatar-photo" : "avatar-mark";
  return el("span", { class: "avatar-stage is-tile", "aria-hidden": "true" }, [
    el("span", { class: "avatar-glow" }),
    el("span", { class: "avatar-ring" }),
    el("span", { class: "avatar-glass" }),
    img
  ]);
}

export function mountAvatarPicker(container, profile, session, onChange) {
  let premium = [];
  const discordUrl = discordAvatarUrl(session);
  const showDiscord = signedInWithDiscord(session);

  const grid = el("div", { class: "avatar-picker", role: "radiogroup", "aria-label": "Avatar" });
  const accentBtn = el("button", {
    type: "button",
    class: "avatar-choice",
    role: "radio",
    "data-avatar": ""
  });
  const ghostButtons = GHOST_MARKS.map((mark) => {
    const button = el("button", {
      type: "button",
      class: "avatar-choice",
      role: "radio",
      "data-avatar": mark.id
    }, [
      stage(ghostMarkPath(mark.id), false),
      el("span", { class: "avatar-choice-label" }, mark.label)
    ]);
    button.addEventListener("click", () => onChange({ avatar: mark.id }));
    return button;
  });
  const uploadImg = el("img", { alt: "", hidden: true });
  const uploadFace = el("span", { class: "avatar-stage is-tile", "aria-hidden": "true" }, [
    el("span", { class: "avatar-glow" }),
    el("span", { class: "avatar-ring" }),
    el("span", { class: "avatar-glass" }),
    el("span", { class: "avatar-upload-mark" }, "＋"),
    uploadImg
  ]);
  const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", class: "sr-only", tabindex: "-1" });
  const upload = el("label", { class: "avatar-choice", role: "radio", "data-avatar": "upload" }, [
    file,
    uploadFace,
    el("span", { class: "avatar-choice-label" }, "Upload your own")
  ]);
  upload.addEventListener("click", (event) => event.stopPropagation());
  file.addEventListener("change", () => {
    const chosen = file.files && file.files[0];
    file.value = "";
    if (!chosen) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(chosen.type)) {
      onChange({ error: "Use a PNG, JPEG, WebP, or GIF." });
      return;
    }
    if (chosen.size > 260000) {
      onChange({ error: "That image is over 250 KB. Paste an https link instead." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = safeAvatar(String(reader.result || ""));
      if (!value) {
        onChange({ error: "Couldn't read that image." });
        return;
      }
      onChange({ avatar: "upload", avatarUrl: value });
    };
    reader.onerror = () => onChange({ error: "Couldn't read that image." });
    reader.readAsDataURL(chosen);
  });

  let discordBtn = null;
  if (showDiscord) {
    discordBtn = el("button", {
      type: "button",
      class: "avatar-choice",
      role: "radio",
      "data-avatar": "discord"
    }, [
      discordUrl ? stage(discordUrl, true) : stage(ghostMarkPath("cool"), false),
      el("span", { class: "avatar-choice-label" }, "Use Discord avatar")
    ]);
    discordBtn.addEventListener("click", () => {
      if (!discordUrl) {
        onChange({ error: "Discord didn't share an avatar on this sign-in." });
        return;
      }
      onChange({ avatar: "discord", avatarUrl: discordUrl });
    });
  }

  accentBtn.addEventListener("click", () => onChange({ avatar: "" }));
  grid.append(accentBtn, ...ghostButtons, upload);
  if (discordBtn) grid.append(discordBtn);
  bindRadioGroup(grid);
  container.replaceChildren(grid);

  function paintAccent() {
    const preview = resolveAvatar({
      accent: profile.accent,
      avatarUrl: "",
      settings: { avatar: "", logo_image: profile.settings?.logo_image }
    }, premium);
    const label = preview.src === ghostMarkPath(defaultGhostId(profile.accent))
      ? (defaultGhostId(profile.accent) === "cool" ? "Neon Cool" : "Cute Glow")
      : "Your logo";
    accentBtn.replaceChildren(
      stage(preview.src, preview.photo),
      el("span", { class: "avatar-choice-label" }, label)
    );
  }

  function sync(next) {
    profile = next;
    grid.style.setProperty("--accent", next.accent || "#8f6cff");
    paintAccent();
    const choice = normalizeAvatarChoice(next.settings?.avatar);
    const uploaded = choice === "upload" && next.avatarUrl;
    uploadImg.hidden = !uploaded;
    uploadImg.className = "avatar-photo";
    if (uploaded) uploadImg.src = absSrc(next.avatarUrl);
    uploadFace.querySelector(".avatar-upload-mark").hidden = Boolean(uploaded);
    grid.querySelectorAll("[data-avatar]").forEach((node) => {
      const on = (node.getAttribute("data-avatar") || "") === choice;
      node.setAttribute("aria-checked", on ? "true" : "false");
      node.tabIndex = on ? 0 : -1;
    });
  }

  sync(profile);
  loadPremiumAvatars().then((list) => {
    premium = list;
    const extras = list.map((item) => {
      const button = el("button", {
        type: "button",
        class: "avatar-choice",
        role: "radio",
        "data-avatar": item.id
      }, [
        stage(`assets/brand/avatars/${item.file}`, true),
        el("span", { class: "avatar-choice-label" }, item.label)
      ]);
      button.addEventListener("click", () => onChange({ avatar: item.id }));
      return button;
    });
    if (extras.length) upload.before(...extras);
    sync(profile);
  });

  return { sync };
}
