/** URL helpers for GitHub Pages pretty paths and local links.
    Keep prettyPathRedirect in sync with the bootstrap in 404.html. */

export function prettyPathRedirect(pathname, hostname) {
  let parts = [];
  try {
    parts = String(pathname || "").split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }
  const last = parts[parts.length - 1] || "";
  if (/\.[a-z0-9]+$/i.test(last)) return null;
  const project = /\.github\.io$/i.test(hostname || "") && parts.length >= 2;
  const baseParts = project ? parts.slice(0, 1) : [];
  const routeParts = project ? parts.slice(1) : parts.slice();
  const base = `/${baseParts.length ? `${baseParts[0]}/` : ""}`;
  const route = routeParts.join("/");
  if (!route || route === "index.html") return base || "/";
  if (route === "editor" || route === "editor.html" || route === "create") return `${base}?page=editor`;
  if (routeParts.length === 1) return `${base}?u=${encodeURIComponent(routeParts[0].toLowerCase())}`;
  return base || "/";
}

export function baseFromPath(pathname) {
  const path = String(pathname || "/");
  if (path.endsWith("/editor.html")) return path.slice(0, -"editor.html".length);
  if (path.endsWith("/index.html")) return path.slice(0, -"index.html".length);
  if (path.endsWith("/404.html")) return path.slice(0, -"404.html".length);
  return path.endsWith("/") ? path : path.replace(/[^/]*$/, "");
}

export function siteBase() {
  return baseFromPath(window.location.pathname);
}

export function homeHref() {
  return siteBase() || "./";
}

export function editorHref() {
  return `${siteBase()}editor.html`;
}

export function publicHref(username) {
  const name = String(username || "").trim().toLowerCase();
  return `${siteBase()}?u=${encodeURIComponent(name)}`;
}

/** Project sites on *.github.io live under /repo/. A custom domain is at the root. */
export function appBasePath(pathname, hostname) {
  if (/\.github\.io$/i.test(hostname || "")) {
    const first = String(pathname || "/").split("/").filter(Boolean)[0];
    return first ? `/${first}/` : "/";
  }
  return "/";
}

export function editorRedirectUrl(origin, pathname, hostname) {
  const base = appBasePath(pathname, hostname);
  return new URL(`${base}editor.html`, origin).href;
}
