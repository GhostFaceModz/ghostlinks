import { isDemoMode, currentSession } from "./store.js";
import { editorHref } from "./route.js";

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
  try {
    const session = await currentSession();
    if (session) {
      signIn.textContent = "Your editor";
      signIn.href = editorHref();
    } else {
      signIn.textContent = "Sign in";
      signIn.href = editorHref();
    }
  } catch {
    signIn.textContent = "Editor";
    signIn.href = editorHref();
  }
}
