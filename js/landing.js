import { isDemoMode } from "./config-state.js";
import { editorHref } from "./route.js";

function hasStoredSession() {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key) || "";
      if (raw.includes("access_token")) return true;
    }
  } catch {
    /* private mode */
  }
  return false;
}

export async function initLanding() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
  const note = document.getElementById("mode-note");
  const signIn = document.getElementById("nav-signin");
  if (isDemoMode()) {
    if (note) note.hidden = false;
    if (signIn) {
      signIn.textContent = "Open the editor";
      signIn.href = editorHref();
    }
    return;
  }
  if (note) note.hidden = true;
  if (!signIn) return;
  // Do not import store.js here. That module loads the Supabase client from jsDelivr.
  // A stored auth token is enough to label the link; the editor checks the session itself.
  signIn.textContent = hasStoredSession() ? "Your editor" : "Sign in";
  signIn.href = editorHref();
}
