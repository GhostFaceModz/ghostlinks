import { el } from "./dom.js";
import { svgIcon } from "./icons.js";
import {
  BACKGROUNDS,
  FONTS,
  LIMITS,
  THEMES,
  normalizeAccent,
  parseYouTubeId,
  platformFromUrl,
  platformLabel,
  safeAvatar
} from "./model.js";
import { MAX_EFFECTS, normalizeSettings } from "./looks.js";
import { mountEffectCards, mountSplashCards, toggleEffect } from "./market.js";
import { mountSplashGallery } from "./splash-gallery.js";
import { mountPage } from "./page.js";
import { bindRadioGroup } from "./radios.js";
import { editorHref, homeHref, publicHref } from "./route.js";
import {
  clearLocal,
  currentSession,
  isDemoMode,
  loadOwn,
  saveProfile,
  signInWithDiscord,
  signOut,
  usernameAvailable
} from "./store.js";

export async function mountEditor(app) {
  document.body.classList.add("mode-editor");
  try {
    const demo = isDemoMode();
    const session = demo ? null : await currentSession();
    if (!demo && !session) {
      wireSignIn(new URLSearchParams(location.search).get("error_description"));
      return;
    }
    const loaded = await loadOwn(session);
    loaded.profile.settings = normalizeSettings(loaded.profile.settings);
    renderEditor(app, loaded.profile, loaded.persistedUsername, session, demo);
    const skip = document.querySelector("a.skip");
    if (skip) skip.setAttribute("href", "#editor-shell");
  } catch (error) {
    app.replaceChildren(el("main", { id: "editor-signin", class: "notice-card editor-gate" }, [
      el("h1", {}, "The editor couldn't open"),
      el("p", {}, error.message || "Try again in a moment."),
      el("a", { class: "land-button", href: homeHref() }, "Back home")
    ]));
  }
}

function wireSignIn(oauthError) {
  const card = document.getElementById("editor-signin");
  const status = document.getElementById("editor-status");
  const button = document.getElementById("discord-signin");
  if (status && oauthError) status.textContent = oauthError;
  if (!button || button.dataset.wired === "true") return;
  button.dataset.wired = "true";
  button.addEventListener("click", async () => {
    button.disabled = true;
    if (status) status.textContent = "Redirecting to Discord…";
    try {
      await signInWithDiscord();
    } catch (error) {
      button.disabled = false;
      if (status) status.textContent = error.message || "Discord sign-in didn't start.";
    }
  });
  if (!card) return;
}

function renderEditor(app, profile, persistedUsername, session, demo) {
  let savedUsername = persistedUsername || "";
  let pageApi = null;
  let nameTicket = 0;
  let nameTimer = 0;
  let nameState = { ok: false, message: "" };

  const status = el("p", { class: "ed-status", id: "save-status", role: "status" });
  const nameStatus = el("p", { class: "ed-hint", id: "username-status", role: "status" });
  const viewLink = el("a", { class: "ed-text", href: publicHref(profile.username || "demo") }, "View page");
  const previewHost = el("div", { class: "preview-frame" });
  const linkList = el("div", { class: "ed-stack" });
  const trackList = el("div", { class: "ed-stack" });

  const username = el("input", {
    id: "username",
    class: "ed-input",
    value: profile.username || "",
    maxlength: "20",
    autocapitalize: "off",
    autocomplete: "off",
    spellcheck: "false",
    placeholder: "yourname",
    "aria-describedby": "username-status"
  });
  const displayName = el("input", { id: "display-name", class: "ed-input", value: profile.displayName || "", maxlength: "40" });
  const bio = el("textarea", { id: "bio", class: "ed-input", maxlength: String(LIMITS.bio), rows: "3" });
  bio.value = profile.bio || "";
  const bioCount = el("span", { class: "ed-count" }, `${bio.value.length}/${LIMITS.bio}`);
  const avatarUrl = el("input", { id: "avatar-url", class: "ed-input", type: "url", placeholder: "https://…", value: profile.avatarUrl?.startsWith("data:") ? "" : (profile.avatarUrl || "") });
  const avatarFile = el("input", { id: "avatar-file", class: "ed-file", type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" });
  const accent = el("input", { id: "accent", type: "color", value: normalizeAccent(profile.accent), "aria-label": "Accent colour" });
  const accentText = el("input", { id: "accent-hex", class: "ed-input ed-hex", value: normalizeAccent(profile.accent), maxlength: "7", "aria-label": "Accent hex" });

  function refresh() {
    pageApi?.update(profile);
    const named = String(profile.username || "").trim();
    viewLink.href = named ? publicHref(named) : `${homeHref()}?u=demo`;
    viewLink.textContent = named ? `View /${named}` : "View the demo";
  }

  function scheduleNameCheck() {
    window.clearTimeout(nameTimer);
    const value = username.value.trim().toLowerCase();
    profile.username = value;
    if (username.value !== value) {
      const pos = username.selectionStart;
      username.value = value;
      if (pos != null) username.setSelectionRange(pos, pos);
    }
    refresh();
    if (!value) {
      nameTicket += 1;
      nameState = { ok: false, message: "Choose a username." };
      nameStatus.textContent = "Choose a username.";
      delete nameStatus.dataset.state;
      return;
    }
    nameTimer = window.setTimeout(async () => {
      const mine = ++nameTicket;
      nameStatus.textContent = "Checking…";
      nameStatus.dataset.state = "pending";
      try {
        const result = await usernameAvailable(value, savedUsername);
        if (mine !== nameTicket) return;
        nameState = result;
        nameStatus.textContent = result.message;
        nameStatus.dataset.state = result.ok ? "good" : "bad";
      } catch (error) {
        if (mine !== nameTicket) return;
        nameState = { ok: false, message: error.message };
        nameStatus.textContent = error.message;
        nameStatus.dataset.state = "bad";
      }
    }, 280);
  }

  username.addEventListener("input", scheduleNameCheck);
  displayName.addEventListener("input", () => {
    profile.displayName = displayName.value;
    refresh();
  });
  bio.addEventListener("input", () => {
    profile.bio = bio.value;
    bioCount.textContent = `${bio.value.length}/${LIMITS.bio}`;
    refresh();
  });
  avatarUrl.addEventListener("input", () => {
    profile.avatarUrl = avatarUrl.value.trim();
    refresh();
  });
  avatarFile.addEventListener("change", () => {
    const file = avatarFile.files && avatarFile.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      status.textContent = "Use a PNG, JPEG, WebP, or GIF.";
      return;
    }
    if (file.size > 260000) {
      status.textContent = "That image is over 250 KB. Paste an https link instead.";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = safeAvatar(String(reader.result || ""));
      if (!value) {
        status.textContent = "Couldn't read that image.";
        return;
      }
      profile.avatarUrl = value;
      avatarUrl.value = "";
      status.textContent = "Image added. Save to keep it.";
      refresh();
    };
    reader.readAsDataURL(file);
  });

  function setAccent(value) {
    const next = normalizeAccent(value, profile.accent);
    profile.accent = next;
    accent.value = next;
    accentText.value = next;
    refresh();
  }
  accent.addEventListener("input", () => setAccent(accent.value));
  accentText.addEventListener("change", () => setAccent(accentText.value));

  const themeRow = el("div", { class: "choice-row", role: "radiogroup", "aria-label": "Theme" });
  for (const [id, theme] of Object.entries(THEMES)) {
    const button = el("button", { type: "button", class: "swatch", role: "radio", "aria-checked": String(profile.theme === id) }, [
      el("span", { class: "swatch-chip", style: `--swatch:${theme.accent};--swatch-base:${theme.base}` }),
      theme.label
    ]);
    button.addEventListener("click", () => {
      profile.theme = id;
      setAccent(theme.accent);
    });
    themeRow.append(button);
  }
  bindRadioGroup(themeRow);

  const bgRow = el("div", { class: "choice-row", role: "radiogroup", "aria-label": "Background" });
  for (const [id, item] of Object.entries(BACKGROUNDS)) {
    const button = el("button", { type: "button", class: "choice", role: "radio", "aria-checked": String(profile.background === id) }, item.label);
    button.title = item.hint;
    button.addEventListener("click", () => {
      profile.background = id;
      refresh();
    });
    bgRow.append(button);
  }
  bindRadioGroup(bgRow);

  const splashRow = el("div", { role: "radiogroup", "aria-label": "Click-to-enter style" });
  mountSplashCards(splashRow, profile, (id) => {
    profile.settings.splash = id;
    refresh();
    pageApi?.replay();
  });

  const gallery = el("div", { class: "splash-gallery" });
  mountSplashGallery(gallery, profile, (value) => {
    profile.settings.splash_image = value;
    refresh();
  }, (message) => { status.textContent = message; });

  const effectRow = el("div", { role: "group", "aria-label": "Page effects" });
  mountEffectCards(effectRow, profile, (id) => {
    const result = toggleEffect(profile, id, () => {
      status.textContent = `Up to ${MAX_EFFECTS} effects at once. Turn one off first.`;
    });
    if (result != null) refresh();
    return result;
  });

  const fontRow = el("div", { class: "choice-row", role: "radiogroup", "aria-label": "Font" });
  for (const [id, font] of Object.entries(FONTS)) {
    const button = el("button", { type: "button", class: "choice choice-font", role: "radio", style: `font-family:${font.display}`, "aria-checked": String(profile.font === id) }, font.label);
    button.addEventListener("click", () => {
      profile.font = id;
      refresh();
    });
    fontRow.append(button);
  }
  bindRadioGroup(fontRow);

  function renderLinks() {
    linkList.replaceChildren();
    profile.links.forEach((link, index) => linkList.append(linkRow(link, index)));
    addLink.disabled = profile.links.length >= LIMITS.links;
  }

  function linkRow(link, index) {
    const url = el("input", { class: "ed-input", type: "url", value: link.url || "", placeholder: "https://", "aria-label": `Link ${index + 1} URL` });
    const label = el("input", { class: "ed-input", type: "text", value: link.label || "", maxlength: "32", placeholder: "Label", "aria-label": `Link ${index + 1} label` });
    const badge = el("span", { class: `ed-platform platform-${link.platform || "custom"}` }, platformLabel(link.platform || platformFromUrl(link.url)));
    url.addEventListener("input", () => {
      link.url = url.value.trim();
      link.platform = platformFromUrl(link.url);
      badge.className = `ed-platform platform-${link.platform}`;
      badge.textContent = platformLabel(link.platform);
      if (!label.value) link.label = "";
      refresh();
    });
    label.addEventListener("input", () => {
      link.label = label.value;
      refresh();
    });
    return el("div", { class: "ed-row" }, [
      badge,
      el("div", { class: "ed-row-fields" }, [url, label]),
      el("div", { class: "ed-row-actions" }, [
        smallButton("Up", `Move link ${index + 1} up`, index === 0, () => move(profile.links, index, -1, renderLinks)),
        smallButton("Down", `Move link ${index + 1} down`, index === profile.links.length - 1, () => move(profile.links, index, 1, renderLinks)),
        smallButton("Remove", `Remove link ${index + 1}`, false, () => {
          profile.links.splice(index, 1);
          renderLinks();
          refresh();
        })
      ])
    ]);
  }

  function renderTracks() {
    trackList.replaceChildren();
    profile.tracks.forEach((track, index) => trackList.append(trackRow(track, index)));
    addTrack.disabled = profile.tracks.length >= LIMITS.tracks;
  }

  function trackRow(track, index) {
    const url = el("input", {
      class: "ed-input",
      type: "url",
      value: track.url || (track.id ? `https://www.youtube.com/watch?v=${track.id}` : ""),
      placeholder: "YouTube or YouTube Music link",
      "aria-label": `Track ${index + 1}`
    });
    const title = el("input", { class: "ed-input", type: "text", value: track.title || "", maxlength: "80", placeholder: "Title (optional)", "aria-label": `Track ${index + 1} title` });
    url.addEventListener("input", () => {
      track.url = url.value.trim();
      track.id = parseYouTubeId(track.url);
      refresh();
    });
    title.addEventListener("input", () => {
      track.title = title.value;
      refresh();
    });
    return el("div", { class: "ed-row" }, [
      el("span", { class: "ed-platform platform-youtube" }, "YouTube"),
      el("div", { class: "ed-row-fields" }, [url, title]),
      el("div", { class: "ed-row-actions" }, [
        smallButton("Remove", `Remove track ${index + 1}`, false, () => {
          profile.tracks.splice(index, 1);
          renderTracks();
          refresh();
        })
      ])
    ]);
  }

  function move(list, index, delta, rerender) {
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(next, 0, item);
    rerender();
    refresh();
  }

  const addLink = el("button", { class: "ed-text", type: "button" }, "Add a link");
  addLink.addEventListener("click", () => {
    if (profile.links.length >= LIMITS.links) return;
    profile.links.push({ url: "", label: "", platform: "custom" });
    renderLinks();
  });
  const addTrack = el("button", { class: "ed-text", type: "button" }, "Add a track");
  addTrack.addEventListener("click", () => {
    if (profile.tracks.length >= LIMITS.tracks) return;
    profile.tracks.push({ url: "", id: "", title: "", artist: "" });
    renderTracks();
  });

  const enterSwitch = switchButton("Show a click-to-enter screen", () => profile.enterScreen !== false, (value) => { profile.enterScreen = value; }, () => {
    refresh();
    if (profile.enterScreen) pageApi?.replay();
  });
  const publishSwitch = switchButton("Published — anyone with the link can view it", () => profile.published !== false, (value) => { profile.published = value; }, () => refresh());

  const save = el("button", { class: "land-button", type: "submit" }, demo ? "Save in this browser" : "Save page");
  const form = el("form", { class: "ed-form", id: "editor-form" }, [
    demo ? el("p", { class: "ed-banner" }, "Demo mode. This page stays in this browser until Supabase is connected in config.js.") : null,
    session ? el("p", { class: "ed-banner" }, `Signed in${displaySession(session)}.`) : null,
    el("fieldset", {}, [
      el("legend", {}, "Page"),
      field("username", "Username", username),
      nameStatus,
      el("p", { class: "ed-hint" }, "This becomes ghostapps.org/username. 3–20 characters."),
      field("display-name", "Display name", displayName),
      field("bio", "Bio", bio),
      el("p", { class: "ed-hint ed-right" }, [bioCount]),
      field("avatar-url", "Avatar URL", avatarUrl),
      el("label", { class: "ed-file-label", for: "avatar-file" }, "Or choose a small image"),
      avatarFile
    ]),
    el("fieldset", {}, [
      el("legend", {}, `Links · up to ${LIMITS.links}`),
      el("p", { class: "ed-hint" }, "Discord, YouTube, TikTok, X, Instagram, Twitch, GitHub, Spotify, or any https link. The icon is picked from the address."),
      linkList,
      addLink
    ]),
    el("fieldset", {}, [
      el("legend", {}, "Look"),
      el("p", { class: "ed-label" }, "Theme"),
      themeRow,
      el("p", { class: "ed-label" }, "Background"),
      bgRow,
      el("p", { class: "ed-label" }, "Click-to-enter style"),
      splashRow,
      el("p", { class: "ed-label" }, "Entrance image"),
      el("p", { class: "ed-hint" }, "A preset from the gallery, or your own image. Missing files stay as quiet placeholders."),
      gallery,
      el("p", { class: "ed-label" }, "Page effects"),
      el("p", { class: "ed-hint" }, `Turn on up to ${MAX_EFFECTS}. They stack, stay light on phones, and switch off with reduced motion.`),
      effectRow,
      el("p", { class: "ed-label" }, "Accent colour"),
      el("div", { class: "accent-row" }, [accent, accentText]),
      el("p", { class: "ed-label" }, "Font"),
      fontRow,
      enterSwitch,
      publishSwitch
    ]),
    el("fieldset", {}, [
      el("legend", {}, `Music · up to ${LIMITS.tracks}`),
      el("p", { class: "ed-hint" }, "Paste a YouTube or YouTube Music link. Playback starts after click-to-enter, so the browser allows sound."),
      trackList,
      addTrack
    ]),
    el("div", { class: "ed-savebar" }, [save, viewLink]),
    status
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    status.textContent = "Saving…";
    try {
      const saved = await saveProfile(profile, session);
      savedUsername = saved.username;
      profile.username = saved.username;
      username.value = saved.username;
      nameState = { ok: true, message: "This is your username." };
      nameStatus.textContent = nameState.message;
      nameStatus.dataset.state = "good";
      status.textContent = demo ? "Saved in this browser." : "Saved. Your page is live for anyone with the link.";
      refresh();
    } catch (error) {
      status.textContent = error.message || "Couldn't save.";
    } finally {
      save.disabled = false;
    }
  });

  const replay = el("button", { class: "ed-text", type: "button" }, "Replay entrance");
  replay.addEventListener("click", () => pageApi?.replay());
  const signOutButton = el("button", { class: "ed-text", type: "button" }, "Sign out");
  signOutButton.addEventListener("click", async () => {
    await signOut();
    window.location.href = homeHref();
  });
  const reset = el("button", { class: "ed-text", type: "button" }, "Clear demo page");
  reset.addEventListener("click", () => {
    clearLocal();
    window.location.href = editorHref();
  });

  const header = el("header", { class: "ed-header" }, [
    el("a", { class: "wordmark", href: homeHref() }, [svgIcon("ghost"), el("span", {}, ["GHOST", el("span", {}, "LINKS")])]),
    el("div", { class: "ed-header-actions" }, [
      el("a", { class: "ed-text", href: "#preview" }, "Skip to preview"),
      demo ? reset : null,
      session ? signOutButton : null
    ])
  ]);

  const previewColumn = el("aside", { class: "ed-preview", id: "preview", "aria-label": "Live preview" }, [
    el("div", { class: "ed-preview-bar" }, [el("h2", {}, "Preview"), replay]),
    previewHost
  ]);

  const previewToggle = el("button", { type: "button", class: "preview-fab", "aria-controls": "preview", "aria-expanded": "false" }, "Preview");
  previewToggle.addEventListener("click", () => {
    const open = previewColumn.classList.toggle("is-open");
    previewToggle.setAttribute("aria-expanded", String(open));
    previewToggle.textContent = open ? "Close preview" : "Preview";
  });

  app.replaceChildren(el("div", { class: "ed-shell", id: "editor-shell" }, [
    header,
    el("div", { class: "ed-layout" }, [
      el("div", { class: "ed-main" }, [form]),
      previewColumn
    ]),
    previewToggle
  ]));

  renderLinks();
  renderTracks();
  pageApi = mountPage(previewHost, profile, { preview: true });
  scheduleNameCheck();
  refresh();
}

function field(id, label, control) {
  return el("div", { class: "ed-field" }, [el("label", { for: id }, label), control]);
}

function smallButton(text, label, disabled, onClick) {
  const button = el("button", { type: "button", class: "ed-text", "aria-label": label }, text);
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function switchButton(label, get, set, onChange) {
  const button = el("button", { type: "button", class: "switch", role: "switch", "aria-checked": String(!!get()) }, [
    el("span", { class: "switch-ui", "aria-hidden": "true" }),
    el("span", {}, label)
  ]);
  button.addEventListener("click", () => {
    set(!get());
    button.setAttribute("aria-checked", String(!!get()));
    onChange();
  });
  return button;
}

function displaySession(session) {
  const meta = session.user?.user_metadata || {};
  const name = meta.full_name || meta.name || session.user?.email || "";
  return name ? ` as ${name}` : "";
}
