import { prettyPathRedirect } from "./route.js";

const target = prettyPathRedirect(window.location.pathname, window.location.hostname);
const here = window.location.pathname + window.location.search;
if (!target) {
  const note = document.getElementById("redirect-note");
  if (note) note.textContent = "That file isn't part of GhostLinks.";
} else if (target !== here) {
  window.location.replace(target + window.location.hash);
}
