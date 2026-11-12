/** Marketplace cards. Previews loop only while the card is on screen. */

import { el } from "./dom.js";
import { EFFECTS, MAX_EFFECTS, SPLASHES } from "./looks.js";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function watch(cards) {
  if (reduced() || !("IntersectionObserver" in window)) {
    cards.forEach((card) => card.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle("is-visible", entry.isIntersecting);
  }, { rootMargin: "120px 0px" });
  cards.forEach((card) => observer.observe(card));
}

function cardShell(stageClass, label, tag, pressed) {
  return el("button", { type: "button", class: "market-card", "aria-pressed": String(pressed) }, [
    el("span", { class: `market-stage ${stageClass}`, "aria-hidden": "true" }, [
      el("i", {}, "Aa"),
      el("b"),
      el("s"),
      el("s"),
      el("s")
    ]),
    el("span", { class: "market-copy" }, [
      el("strong", {}, label),
      el("em", {}, tag)
    ])
  ]);
}

export function mountSplashCards(container, profile, onPick) {
  const cards = [];
  container.replaceChildren();
  container.classList.add("market-grid");
  for (const splash of SPLASHES) {
    const button = cardShell(`mini-${splash.id}`, splash.label, splash.tag, profile.settings.splash === splash.id);
    button.title = splash.hint;
    button.addEventListener("click", () => {
      onPick(splash.id);
      container.querySelectorAll(".market-card").forEach((node) => node.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
    });
    container.append(button);
    cards.push(button);
  }
  watch(cards);
}

export function mountEffectCards(container, profile, onToggle) {
  const cards = [];
  container.replaceChildren();
  container.classList.add("market-grid");
  for (const effect of EFFECTS) {
    const button = cardShell(`fxmini fxmini-${effect.id}`, effect.label, effect.tag, profile.settings.effects.includes(effect.id));
    button.addEventListener("click", () => {
      const turnedOn = onToggle(effect.id);
      if (turnedOn == null) return;
      button.setAttribute("aria-pressed", String(turnedOn));
    });
    container.append(button);
    cards.push(button);
  }
  watch(cards);
}

export function toggleEffect(profile, id, onLimit) {
  const list = profile.settings.effects;
  const index = list.indexOf(id);
  if (index >= 0) {
    list.splice(index, 1);
    return false;
  }
  if (list.length >= MAX_EFFECTS) {
    onLimit();
    return null;
  }
  list.push(id);
  return true;
}
