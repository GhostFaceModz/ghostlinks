import { el } from "./dom.js";
import { svgIcon } from "./icons.js";
import { FONTS, THEMES, normalizeProfile, profileBadges } from "./model.js";
import { EFFECTS, activeBackdrop, resolveAvatar } from "./looks.js";
import { loadPremiumAvatars } from "./avatar-picker.js";
import { mountBackdrop } from "./backdrops.js";
import { frameSrc, loadFrameManifest } from "./frames.js";
import { mountOverlays } from "./overlays.js";
import { bindPlayer } from "./player.js";
import { homeHref, siteBase } from "./route.js";
import { recordView } from "./store.js";

function setInert(node, on) {
  if (on) node.setAttribute("inert", "");
  else node.removeAttribute("inert");
}

function readViews(username) {
  try {
    const count = Number(localStorage.getItem(`ghostlinks.views.${username}`));
    return Number.isSafeInteger(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

function bumpViews(username) {
  const next = readViews(username) + 1;
  try { localStorage.setItem(`ghostlinks.views.${username}`, String(next)); } catch { /* ignore */ }
  return next;
}

function motionAllowed() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try { return localStorage.getItem("ghostlinks.motion") !== "off"; } catch { return true; }
}

function absAsset(src) {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("https://") || src.startsWith("http://")) return src;
  return `${siteBase()}${src}`;
}

function avatarStage(className) {
  const img = el("img", { alt: "" });
  return el("span", { class: className }, [
    el("span", { class: "avatar-glow", "aria-hidden": "true" }),
    el("span", { class: "avatar-ring", "aria-hidden": "true" }),
    el("span", { class: "avatar-glass", "aria-hidden": "true" }),
    img
  ]);
}

function paintStage(stage, portrait, alt) {
  const img = stage.querySelector("img");
  const src = absAsset(portrait.src);
  if (img.getAttribute("src") !== src) img.src = src;
  img.alt = alt || "";
  img.className = portrait.photo ? "avatar-photo" : "avatar-mark";
  stage.classList.toggle("is-photo", Boolean(portrait.photo));
}

function logoUrl(value) {
  if (!value) return "";
  return value.startsWith("data:") ? value : `${siteBase()}${value}`;
}

function applyLook(page, profile) {
  const theme = THEMES[profile.theme] || THEMES.nebula;
  const font = FONTS[profile.font] || FONTS.unbounded;
  page.style.setProperty("--base", theme.base);
  page.style.setProperty("--ink", theme.ink);
  page.style.setProperty("--muted", theme.muted);
  page.style.setProperty("--accent", profile.accent || theme.accent);
  page.style.setProperty("--font-display", font.display);
  page.style.setProperty("--font-ui", font.ui);
  page.dataset.theme = profile.theme;
  page.dataset.font = profile.font;
}

export function mountPage(container, rawProfile, options = {}) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let profile = normalizeProfile(rawProfile);
  let entered = !profile.enterScreen;
  let motionOn = motionAllowed();
  let backgroundName = "";
  let linkSignature = "";
  let trackSignature = "";
  let playerApi = null;
  let backgroundApi = null;
  let overlayApi = null;
  let typeTimer = 0;
  let typedKey = "";
  let premiumAvatars = [];
  const counted = profile.username ? readViews(profile.username) : 0;

  const page = el("div", {
    class: `gl-page ${options.preview ? "is-preview" : "is-live"}`,
    id: options.preview ? null : "content"
  });
  const scene = el("div", { class: "scene", "aria-hidden": "true" });
  const entrance = el("div", { class: "entrance", "data-splash": "ghost" });
  const experience = el("div", { class: "experience" });
  const fxHost = el("div", { class: "fx-host", "aria-hidden": "true" });
  page.append(scene, fxHost, entrance, experience);

  const ghost = avatarStage("splash-ghost avatar-stage");
  const splashName = el("span", { class: "splash-name" });
  const splashHandle = el("span", { class: "splash-handle" });
  const enterButton = el("button", { class: "enter-button", type: "button" }, [
    ghost,
    splashName,
    splashHandle,
    el("span", { class: "pill-wrap" }, [
      el("span", { class: "enter-pill" }, [el("span", { class: "enter-tag" }, "Click to enter")])
    ]),
    el("span", { class: "enter-hint" }, "or tap anywhere")
  ]);
  const splashNote = el("p", { class: "splash-note" });
  entrance.append(
    el("div", { class: "splash-stage", "aria-hidden": "true" }),
    el("div", { class: "splash-brand", "aria-hidden": "true" }, [svgIcon("ghost"), "GHOST", el("span", {}, "LINKS")]),
    enterButton,
    splashNote
  );

  const motionButton = el("button", { class: "motion-button", type: "button" }, [svgIcon("motion"), el("span", {}, "Motion")]);
  const soundButton = el("button", { class: "motion-button sound-pill", type: "button", "aria-pressed": "false" }, [svgIcon("sound"), el("span", {}, "Sound")]);
  const brand = el("a", { class: "wordmark", href: homeHref() }, [svgIcon("ghost"), el("span", {}, ["GHOST", el("span", {}, "LINKS")])]);
  if (options.preview) brand.addEventListener("click", (event) => event.preventDefault());
  const topbar = el("header", { class: "topbar" }, [brand, el("div", { class: "top-actions" }, [soundButton, motionButton])]);

  const banner = el("div", { class: "banner", "aria-hidden": "true" }, [el("span", { class: "banner-fade" })]);
  const avatarWrap = avatarStage("avatar-wrap avatar-stage");
  const cardLogo = el("img", { class: "card-logo", alt: "", hidden: true });
  const frameImg = el("img", { class: "avatar-frame", alt: "", hidden: true });
  avatarWrap.append(frameImg);
  const badges = el("ul", { class: "badges" });
  const presence = el("div", { class: "presence", hidden: true });
  const name = el("h1", { class: "profile-name" });
  const handle = el("p", { class: "handle" });
  const bio = el("p", { class: "bio" });
  const socials = el("nav", { class: "socials", "aria-label": "Links" });
  const music = musicShell();
  const viewCount = el("span", { class: "view-count" });
  const viewWords = document.createTextNode(" visits on this device");
  const viewLine = el("p", { class: "views", title: "Visits to this page in this browser. Not a server-wide total." }, [svgIcon("eye"), viewCount, viewWords]);
  const card = el("article", { class: "card" }, [
    el("div", { class: "card-edge", "aria-hidden": "true" }),
    banner,
    cardLogo,
    avatarWrap,
    badges,
    presence,
    name,
    handle,
    bio,
    socials,
    music,
    viewLine
  ]);
  const footerLink = el("a", { href: homeHref() }, "Made with GhostApps");
  if (options.preview) footerLink.addEventListener("click", (event) => event.preventDefault());
  const footer = el("footer", { class: "page-footer" }, [footerLink]);
  experience.append(topbar, el("main", {}, [el("div", { class: "card-wrap" }, [card])]), footer);
  container.replaceChildren(page);

  function paintCopy() {
    const shown = profile.displayName || "Your name";
    const at = profile.username || "username";
    splashName.textContent = shown;
    splashName.dataset.text = shown;
    splashHandle.textContent = `@${at}`;
    enterButton.setAttribute("aria-label", `Click to enter ${shown}'s page`);
    splashNote.textContent = profile.tracks.length ? "Sound starts when you enter" : "A quiet page, until you add a song";
    name.textContent = shown;
    name.dataset.text = shown;
    handle.textContent = `@${at}`;
    bio.textContent = profile.bio || "Add a short bio.";
    const signature = JSON.stringify(profile.links);
    if (signature !== linkSignature) {
      linkSignature = signature;
      paintLinks();
    }
    const trackKey = JSON.stringify(profile.tracks);
    if (trackKey !== trackSignature) {
      trackSignature = trackKey;
      music.hidden = profile.tracks.length === 0;
      if (!playerApi && profile.tracks.length) playerApi = bindPlayer(music, profile.tracks);
      else playerApi?.setTracks(profile.tracks);
    }
    entrance.classList.toggle("has-photo", Boolean(profile.settings?.splash_image));
    const portrait = resolveAvatar(profile, premiumAvatars);
    paintStage(ghost, portrait, "");
    paintStage(avatarWrap, portrait, portrait.photo ? `${shown}'s avatar` : "");
    const mark = logoUrl(profile.settings?.logo_image || "");
    const portraitSrc = absAsset(portrait.src);
    cardLogo.hidden = !mark || mark === portraitSrc;
    if (mark && mark !== portraitSrc) {
      cardLogo.src = mark;
      cardLogo.alt = "";
    } else cardLogo.removeAttribute("src");
    const views = profile.username ? (options.countView ? counted : readViews(profile.username)) : 0;
    viewCount.textContent = profile.username ? views.toLocaleString() : "–";
    viewWords.textContent = views === 1 ? " visit" : " visits";
    paintBadges();
    paintPresence();
    paintFrame();
    syncLook();
  }

  function paintBadges() {
    badges.replaceChildren();
    for (const badge of profileBadges(profile)) {
      const chip = el("li", { class: `badge badge-${badge.id}` }, [
        badge.id === "discord" ? el("span", { class: "online-dot", "aria-hidden": "true" }) : null,
        svgIcon(badge.id === "music" ? "sound" : badge.id === "motion" ? "motion" : badge.id === "links" ? "link" : "discord"),
        el("span", {}, badge.label)
      ]);
      badges.append(chip);
    }
    badges.hidden = badges.childElementCount === 0;
  }

  function paintPresence() {
    const nameText = profile.discordName || profile.displayName || profile.username;
    if (!profile.discordUserId || !nameText) {
      presence.hidden = true;
      presence.replaceChildren();
      return;
    }
    presence.hidden = false;
    const faceSrc = absAsset(resolveAvatar(profile, premiumAvatars).src);
    const face = el("img", { class: "presence-avatar", alt: "", src: faceSrc, width: "40", height: "40" });
    presence.replaceChildren(
      el("span", { class: "presence-face" }, [face, el("span", { class: "online-dot", "aria-hidden": "true" })]),
      el("span", { class: "presence-name" }, nameText)
    );
  }

  let frameTicket = 0;
  function paintFrame() {
    const id = profile.settings?.avatar_frame || "";
    const ticket = ++frameTicket;
    if (!id) {
      frameImg.hidden = true;
      frameImg.removeAttribute("src");
      return;
    }
    loadFrameManifest().then((frames) => {
      if (ticket !== frameTicket) return;
      const match = frames.find((item) => item.id === id);
      const src = frameSrc(match);
      if (!src) {
        frameImg.hidden = true;
        return;
      }
      frameImg.src = src;
      frameImg.hidden = false;
    }).catch(() => { frameImg.hidden = true; });
  }

  function syncLook() {
    const settings = profile.settings || { splash: "ghost", effects: [] };
    entrance.dataset.splash = settings.splash || "ghost";
    const stage = entrance.querySelector(".splash-stage");
    const image = settings.splash_image || "";
    if (stage) {
      stage.classList.toggle("has-image", Boolean(image));
      stage.style.backgroundImage = image ? `url("${image.replace(/"/g, "")}")` : "";
    }
    for (const effect of EFFECTS) {
      page.classList.toggle(`fx-${effect.id}`, settings.effects.includes(effect.id));
    }
    if (!overlayApi) overlayApi = mountOverlays(fxHost, page, card);
    overlayApi.setEffects(settings.effects);
    overlayApi.setMotion(motionOn);
    syncTypewriter();
  }

  function syncTypewriter() {
    const on = profile.settings?.effects?.includes("typewriter") && motionOn;
    const full = profile.bio || "Add a short bio.";
    const key = `${on}:${full}`;
    if (key === typedKey) return;
    typedKey = key;
    window.clearInterval(typeTimer);
    if (!on) {
      bio.textContent = full;
      return;
    }
    let index = 0;
    bio.textContent = "";
    typeTimer = window.setInterval(() => {
      index += 1;
      bio.textContent = full.slice(0, index);
      if (index >= full.length) window.clearInterval(typeTimer);
    }, 26);
  }

  function paintLinks() {
    socials.replaceChildren();
    if (!profile.links.length) {
      socials.append(el("p", { class: "no-links" }, "Links you add show up here."));
      return;
    }
    profile.links.forEach((link) => {
      const anchor = el("a", {
        class: `social social-${link.platform}`,
        href: link.url,
        target: "_blank",
        rel: "noopener noreferrer"
      }, [
        el("span", { class: "social-icon" }, [svgIcon(link.platform === "custom" ? "link" : link.platform)]),
        el("span", { class: "social-label" }, link.label)
      ]);
      anchor.setAttribute("aria-label", `${link.label} — opens in a new tab`);
      socials.append(anchor);
    });
  }

  function syncBackground() {
    const id = activeBackdrop(profile);
    const media = profile.settings?.background_media || "";
    const key = `${id}|${media}`;
    if (key === backgroundName && backgroundApi) return;
    backgroundApi?.stop();
    backgroundName = key;
    backgroundApi = mountBackdrop(scene, id, media);
    backgroundApi.setMotion(motionOn);
  }

  function setMotion(next) {
    motionOn = next && !reduced.matches;
    page.classList.toggle("motion-off", !motionOn);
    motionButton.setAttribute("aria-pressed", String(!motionOn));
    motionButton.setAttribute("aria-label", motionOn ? "Pause visual motion" : "Play visual motion");
    backgroundApi?.setMotion(motionOn);
    overlayApi?.setMotion(motionOn);
    syncTypewriter();
  }

  function retireGhost() {
    // Lock the flown-away pose. Dismissing the splash clears other animations;
    // without this class the ghost snaps back over the card (animation fill is lost).
    ghost.classList.add("flown");
  }

  function finishEnter(immediate) {
    if (entered && entrance.classList.contains("dismissed")) return;
    entered = true;
    page.classList.add("is-in");
    setInert(experience, false);
    entrance.setAttribute("aria-hidden", "true");
    const wait = immediate || !motionOn ? 0 : 1600;
    window.setTimeout(() => {
      retireGhost();
      entrance.classList.add("dismissed");
      if (profile.tracks.length) playerApi?.activate();
    }, wait);
    if (!options.preview) motionButton.focus({ preventScroll: true });
  }

  function enter() {
    if (entered) return;
    entrance.classList.add("leaving");
    if (!motionOn) {
      retireGhost();
      finishEnter(true);
      return;
    }
    const onEnd = (event) => {
      if (event.animationName !== "ghost-away") return;
      ghost.removeEventListener("animationend", onEnd);
      retireGhost();
    };
    ghost.addEventListener("animationend", onEnd);
    finishEnter(false);
  }

  function replay() {
    entered = false;
    playerApi?.pause();
    page.classList.remove("is-in");
    entrance.classList.remove("leaving", "dismissed");
    entrance.removeAttribute("aria-hidden");
    ghost.classList.remove("flown");
    setInert(experience, true);
    ghost.classList.add("restart");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ghost.classList.remove("restart"));
    });
  }

  enterButton.addEventListener("click", (event) => {
    event.stopPropagation();
    enter();
  });
  entrance.addEventListener("click", enter);
  entrance.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      enter();
    }
  });
  soundButton.addEventListener("click", () => {
    const muted = playerApi?.toggleMute() === true;
    soundButton.setAttribute("aria-pressed", String(muted));
    soundButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  });
  motionButton.addEventListener("click", () => {
    if (reduced.matches) return;
    const next = !motionOn;
    try { localStorage.setItem("ghostlinks.motion", next ? "on" : "off"); } catch { /* ignore */ }
    setMotion(next);
    if (!next && entrance.classList.contains("leaving")) retireGhost();
  });

  applyLook(page, profile);
  syncBackground();
  paintCopy();
  loadPremiumAvatars().then((list) => {
    premiumAvatars = list;
    paintCopy();
  });
  setMotion(motionOn);
  if (options.countView && profile.username) {
    recordView(profile.username).then((count) => {
      if (!Number.isFinite(count)) return;
      viewCount.textContent = count.toLocaleString();
      viewWords.textContent = count === 1 ? " visit" : " visits";
    }).catch(() => {});
  }
  if (profile.enterScreen && !entered) {
    setInert(experience, true);
    if (!options.preview) enterButton.focus({ preventScroll: true });
  } else {
    page.classList.add("is-in");
    entrance.classList.add("dismissed");
    retireGhost();
    setInert(experience, false);
    playerApi?.revealArt();
  }

  document.addEventListener("visibilitychange", onHide);
  function onHide() {
    page.classList.toggle("tab-hidden", document.hidden);
  }

  return {
    update(next) {
      const wasEntered = entered;
      const nextProfile = normalizeProfile(next);
      const screenTurnedOff = profile.enterScreen && !nextProfile.enterScreen;
      profile = nextProfile;
      applyLook(page, profile);
      syncBackground();
      paintCopy();
      if (screenTurnedOff && !wasEntered) finishEnter(true);
    },
    replay() {
      if (!profile.enterScreen) {
        profile = { ...profile, enterScreen: true };
      }
      replay();
    },
    destroy() {
      document.removeEventListener("visibilitychange", onHide);
      playerApi?.destroy();
      backgroundApi?.stop();
      overlayApi?.stop();
      window.clearInterval(typeTimer);
    },
    root: page
  };
}

function musicShell() {
  return el("section", { class: "music", "aria-label": "Music player" }, [
    el("div", { class: "track-row" }, [
      el("div", { class: "cover-wrap" }, [
        el("img", { class: "cover", alt: "", width: "58", height: "58" }),
        el("span", { class: "cover-eq", "aria-hidden": "true" }, [el("i"), el("i"), el("i"), el("i")])
      ]),
      el("div", { class: "track-copy" }, [
        el("p", { class: "now" }, "Ready when you are"),
        el("h2", { class: "track-title" }, "Music"),
        el("p", { class: "track-by" }, "YouTube")
      ]),
      el("span", { class: "track-count" })
    ]),
    el("div", { class: "progress" }, [
      el("span", { class: "elapsed" }, "0:00"),
      el("input", { class: "seek", type: "range", min: "0", max: "100", step: "0.1", value: "0", "aria-label": "Seek" }),
      el("span", { class: "duration" }, "0:00")
    ]),
    el("div", { class: "player-bottom" }, [
      el("div", { class: "volume-wrap" }, [
        el("button", { class: "mute icon-button", type: "button", "aria-label": "Mute", "aria-pressed": "false" }),
        el("input", { class: "volume", type: "range", min: "0", max: "100", step: "1", value: "30", "aria-label": "Volume" })
      ]),
      el("div", { class: "transport" }, [
        el("button", { class: "prev icon-button", type: "button", "aria-label": "Previous track" }, [svgIcon("prev")]),
        el("button", { class: "play play-button", type: "button", "aria-label": "Play" }, [svgIcon("play")]),
        el("button", { class: "next icon-button", type: "button", "aria-label": "Next track" }, [svgIcon("next")])
      ]),
      el("a", { class: "yt-open", href: "https://www.youtube.com", target: "_blank", rel: "noopener noreferrer" }, "YouTube")
    ]),
    el("div", { class: "viz-bars", "aria-hidden": "true" }, [el("i"), el("i"), el("i"), el("i"), el("i"), el("i"), el("i"), el("i"), el("i"), el("i"), el("i"), el("i")]),
    el("div", { class: "yt-host", "aria-hidden": "true" }, [el("div", { class: "yt-slot" })])
  ]);
}
