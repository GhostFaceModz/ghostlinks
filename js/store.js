import { isDemoMode as modeFromConfig, keyLooksLikeServiceRole, readConfig } from "./config-state.js";
import { demoProfile, normalizeProfile, profileIssues, starterProfile, validateUsername } from "./model.js";
import { editorRedirectUrl } from "./route.js";

const STORAGE = "ghostlinks.profile.v1";
let clientPromise = null;

export function isDemoMode() {
  return modeFromConfig();
}

export function readLocal() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function writeLocal(profile) {
  localStorage.setItem(STORAGE, JSON.stringify(profile));
}

export function clearLocal() {
  try { localStorage.removeItem(STORAGE); } catch { /* ignore */ }
}

function editorTracks(tracks) {
  return (Array.isArray(tracks) ? tracks : []).map((track) => ({
    id: track.id || "",
    url: track.url || (track.id ? `https://www.youtube.com/watch?v=${track.id}` : ""),
    title: track.title || "",
    artist: track.artist || ""
  }));
}

export function fromRow(row) {
  return {
    username: row.username || "",
    displayName: row.display_name || "",
    bio: row.bio || "",
    avatarUrl: row.avatar_url || "",
    theme: row.theme,
    background: row.background,
    accent: row.accent_color,
    font: row.font,
    enterScreen: row.enter_screen !== false,
    published: row.published !== false,
    settings: row.settings && typeof row.settings === "object" ? row.settings : {},
    links: Array.isArray(row.links) ? row.links.map((link) => ({ ...link })) : [],
    tracks: editorTracks(row.youtube_tracks),
    discordUserId: /^[0-9]{17,20}$/.test(String(row.discord_user_id || "")) ? String(row.discord_user_id) : "",
    discordName: ""
  };
}

function toRow(profile, userId) {
  const clean = normalizeProfile(profile);
  return {
    id: userId,
    username: clean.username,
    display_name: clean.displayName,
    bio: clean.bio,
    avatar_url: clean.avatarUrl || null,
    theme: clean.theme,
    background: clean.background,
    accent_color: clean.accent,
    font: clean.font,
    links: clean.links,
    youtube_tracks: clean.tracks,
    enter_screen: clean.enterScreen,
    published: clean.published,
    settings: clean.settings
  };
}

export async function getClient() {
  if (isDemoMode()) return null;
  const { url, key } = readConfig();
  if (keyLooksLikeServiceRole(key)) {
    throw new Error("config.js has a service-role key. Replace it with the anon key, and rotate the secret if it was committed.");
  }
  if (!clientPromise) {
    const pending = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.81.1/+esm")
      .then(({ createClient }) => createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce"
        }
      }))
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
    clientPromise = pending;
  }
  return clientPromise;
}

export async function currentSession() {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

function editorReturnUrl() {
  return editorRedirectUrl(window.location.origin, window.location.pathname, window.location.hostname);
}

function clearStaleAuth() {
  // Do not POST /logout. A stale local token makes that call 401.
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
    for (const key of keys) {
      if (key && key.startsWith("sb-") && (key.endsWith("-auth-token") || key.endsWith("-code-verifier"))) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* private mode */ }
}

export async function signInWithProvider(provider) {
  const supabase = await getClient();
  clearStaleAuth();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: editorReturnUrl() }
  });
  if (error) throw error;
}

export async function signInWithDiscord() {
  return signInWithProvider("discord");
}

export async function signInWithMagicLink(email) {
  const supabase = await getClient();
  clearStaleAuth();
  const { error } = await supabase.auth.signInWithOtp({
    email: String(email || "").trim(),
    options: { emailRedirectTo: editorReturnUrl(), shouldCreateUser: true }
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = await getClient();
  if (supabase) await supabase.auth.signOut();
}

const PROFILES = "ghostlinks_profiles";
const PROFILE_COLUMNS = "username,display_name,bio,avatar_url,theme,background,accent_color,font,links,youtube_tracks,enter_screen,published,settings,discord_user_id";

export async function loadOwn(session) {
  if (isDemoMode() || !session) {
    const saved = readLocal();
    if (saved) return { profile: { ...saved, tracks: editorTracks(saved.tracks) }, persistedUsername: saved.username || "" };
    return { profile: starterProfile(), persistedUsername: "" };
  }
  const supabase = await getClient();
  const { data, error } = await supabase.from(PROFILES).select(PROFILE_COLUMNS).eq("id", session.user.id).maybeSingle();
  if (error) throw error;
  if (!data) {
    const meta = session.user.user_metadata || {};
    return {
      profile: starterProfile({
        displayName: meta.full_name || meta.name || "",
        avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : "",
        username: meta.preferred_username || meta.full_name || meta.name || ""
      }),
      persistedUsername: ""
    };
  }
  const profile = fromRow(data);
  return { profile, persistedUsername: profile.username || "" };
}

export async function loadPublic(username) {
  const name = String(username || "").trim().toLowerCase();
  if (name === "demo") return demoProfile();
  const check = validateUsername(name);
  if (!check.ok) return null;
  if (isDemoMode()) {
    const saved = readLocal();
    if (!saved) return null;
    const clean = normalizeProfile(saved);
    return clean.username === check.username && clean.published ? clean : null;
  }
  const supabase = await getClient();
  const { data, error } = await supabase
    .from(PROFILES)
    .select(PROFILE_COLUMNS)
    .eq("username", check.username)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeProfile(fromRow(data)) : null;
}

export async function usernameAvailable(candidate, ownUsername = "") {
  const check = validateUsername(candidate);
  if (!check.ok) return check;
  if (ownUsername && check.username === ownUsername) {
    return { ok: true, username: check.username, code: "yours", message: "This is your username." };
  }
  if (isDemoMode()) return { ok: true, username: check.username, code: "available", message: "Available in this demo." };
  const supabase = await getClient();
  const { data, error } = await supabase.rpc("ghostlinks_username_available", { candidate: check.username });
  if (error) return { ok: false, username: check.username, code: "error", message: "Couldn't check that username just now." };
  if (data === true) return { ok: true, username: check.username, code: "available", message: "Available." };
  return { ok: false, username: check.username, code: "taken", message: "That username is taken." };
}

export async function saveProfile(raw, session) {
  const issues = profileIssues(raw);
  if (issues.length) {
    const error = new Error(issues[0].message);
    error.issues = issues;
    throw error;
  }
  const clean = normalizeProfile(raw);
  if (!clean.username || !clean.displayName) throw new Error("Add a username and a display name.");
  if (isDemoMode() || !session) {
    writeLocal(clean);
    return clean;
  }
  const supabase = await getClient();
  const { error } = await supabase.from(PROFILES).upsert(toRow(clean, session.user.id));
  if (error) {
    if (/duplicate|unique/i.test(error.message || "")) throw new Error("That username was just claimed.");
    throw new Error(error.message || "Couldn't save your page.");
  }
  return clean;
}

function viewerKey() {
  const storageKey = "ghostlinks.viewer";
  try {
    const existing = localStorage.getItem(storageKey) || "";
    if (/^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const next = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 32);
    localStorage.setItem(storageKey, next);
    return next;
  } catch {
    return "localviewerkey00000001";
  }
}

function localView(username) {
  const countKey = `ghostlinks.views.${username}`;
  const seenKey = `ghostlinks.viewed.${username}`;
  let count = 0;
  try {
    const stored = Number(localStorage.getItem(countKey));
    count = Number.isSafeInteger(stored) && stored > 0 ? stored : 0;
    const seen = Number(localStorage.getItem(seenKey));
    if (Number.isFinite(seen) && Date.now() - seen < 6 * 60 * 60 * 1000) return count || 0;
    count += 1;
    localStorage.setItem(countKey, String(count));
    localStorage.setItem(seenKey, String(Date.now()));
  } catch {
    count = Math.max(count, 1);
  }
  return count;
}

export async function recordView(username) {
  const name = String(username || "").trim().toLowerCase();
  if (!name) return 0;
  if (isDemoMode() || name === "demo") return localView(name);
  try {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc("ghostlinks_record_view", {
      page_name: name,
      viewer_key: viewerKey()
    });
    if (error || data == null) return localView(name);
    return Number(data) || 0;
  } catch {
    return localView(name);
  }
}
