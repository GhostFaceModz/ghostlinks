import { baseFromPath, siteBase } from "./route.js";

const params = new URLSearchParams(window.location.search);
const username = (params.get("u") || "").trim().toLowerCase();
const app = document.getElementById("app");

function loadRouteStyles() {
  for (const file of ["profile.css", "looks.css", "backdrops.css"]) {
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href.endsWith(`/${file}`) || link.href.endsWith(file))) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${siteBase()}css/${file}`;
    document.head.append(link);
  }
}

async function boot() {
  if (!app) return;
  if (document.body.dataset.route === "editor") {
    const { mountEditor } = await import("./editor.js");
    await mountEditor(app);
    return;
  }
  if (params.get("page") === "editor") {
    window.location.replace(`${baseFromPath(window.location.pathname)}editor.html${window.location.hash}`);
    return;
  }
  if (username) {
    loadRouteStyles();
    const { mountPublic } = await import("./public.js");
    await mountPublic(app, username, { theme: params.get("theme") || "", background: params.get("bg") || "" });
    return;
  }
  const { initLanding } = await import("./landing.js");
  await initLanding();
}

boot().catch((error) => {
  console.error(error);
  if (!app || document.body.dataset.route !== "editor" && !username) return;
  app.replaceChildren();
  const p = document.createElement("p");
  p.className = "boot-note";
  p.textContent = "GhostLinks couldn't start. Reload the page.";
  app.append(p);
});
