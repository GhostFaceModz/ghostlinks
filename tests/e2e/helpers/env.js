export const LIVE_URL = "https://ghostfacemodz.github.io/ghostlinks/";

export function isLocal() {
  return process.env.E2E_LOCAL === "1" || process.env.E2E_LOCAL === "true";
}

export function localPort() {
  return Number(process.env.E2E_PORT || 4317);
}

export function baseURL() {
  const raw = process.env.BASE_URL || (isLocal() ? `http://127.0.0.1:${localPort()}/` : LIVE_URL);
  return raw.endsWith("/") ? raw : `${raw}/`;
}
