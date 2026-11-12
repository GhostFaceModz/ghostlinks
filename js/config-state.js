/** Reads the public config.js values. Demo mode is the default. */

export function readConfig() {
  const raw = (typeof window !== "undefined" && window.GHOSTLINKS_CONFIG) || {};
  return {
    url: String(raw.supabaseUrl || "").trim().replace(/\/$/, ""),
    key: String(raw.supabaseAnonKey || "").trim()
  };
}

export function isDemoMode(source = readConfig()) {
  const url = source.url || "";
  const key = source.key || "";
  if (!url || !key) return true;
  if (/YOUR_|placeholder|xxxx|<.*>/i.test(`${url} ${key}`)) return true;
  try {
    if (new URL(url).protocol !== "https:") return true;
  } catch {
    return true;
  }
  return false;
}

export function keyLooksLikeServiceRole(key) {
  const parts = String(key || "").split(".");
  if (parts.length !== 3) return false;
  try {
    const body = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    return json.role === "service_role";
  } catch {
    return false;
  }
}
