import { el } from "./dom.js";
import { BACKGROUNDS, THEMES } from "./model.js";
import { mountPage } from "./page.js";
import { editorHref, homeHref, siteBase } from "./route.js";
import { loadPublic } from "./store.js";

function setMeta(attr, key, content) {
  let node = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attr, key);
    document.head.append(node);
  }
  node.setAttribute("content", content);
}

export async function mountPublic(container, username, query = {}) {
  document.body.classList.add("mode-public");
  container.replaceChildren(el("p", { class: "boot-note" }, "Opening this page…"));
  try {
    let profile = await loadPublic(username);
    if (!profile) {
      document.title = "Page not found · GhostLinks";
      container.replaceChildren(missing(username));
      return;
    }
    if (username === "demo") {
      if (THEMES[query.theme]) profile = { ...profile, theme: query.theme, accent: THEMES[query.theme].accent };
      if (BACKGROUNDS[query.background]) profile = { ...profile, background: query.background };
    }
    const title = `${profile.displayName} · @${profile.username}`;
    document.title = title;
    const description = profile.bio || `Animated bio page for @${profile.username} on GhostLinks.`;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", window.location.href);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    const image = new URL(`${siteBase()}assets/brand/og.webp`, window.location.origin).href;
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:image", image);
    setMeta("name", "twitter:card", "summary_large_image");
    mountPage(container, profile, { countView: true });
  } catch (error) {
    document.title = "GhostLinks";
    container.replaceChildren(el("div", { class: "notice-card" }, [
      el("h1", {}, "This page didn't load"),
      el("p", {}, error.message || "Check the connection and try again."),
      el("a", { class: "land-button", href: homeHref() }, "Back home")
    ]));
  }
}

function missing(username) {
  return el("div", { class: "notice-card" }, [
    el("p", { class: "eyebrow" }, "GhostLinks"),
    el("h1", {}, "This ghost hasn't appeared yet"),
    el("p", {}, `@${username || "unknown"} doesn't have a published page.`),
    el("div", { class: "land-actions" }, [
      el("a", { class: "land-button", href: editorHref() }, "Create your page"),
      el("a", { class: "land-button land-button-quiet", href: `${homeHref()}?u=demo` }, "View the demo")
    ])
  ]);
}
