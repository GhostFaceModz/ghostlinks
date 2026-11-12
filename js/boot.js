import { initLanding } from "./landing.js";
import { mountEditor } from "./editor.js";
import { mountPublic } from "./public.js";
import { baseFromPath } from "./route.js";

const params = new URLSearchParams(window.location.search);
const username = (params.get("u") || "").trim().toLowerCase();
const app = document.getElementById("app");

async function boot() {
  if (!app) return;
  if (document.body.dataset.route === "editor") {
    await mountEditor(app);
    return;
  }
  if (params.get("page") === "editor") {
    window.location.replace(`${baseFromPath(window.location.pathname)}editor.html${window.location.hash}`);
    return;
  }
  if (username) {
    await mountPublic(app, username, { theme: params.get("theme") || "", background: params.get("bg") || "" });
    return;
  }
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
