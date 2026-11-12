const NS = "http://www.w3.org/2000/svg";

const ICONS = {
  ghost: { fill: true, d: "M12 3c-3.7 0-6.5 2.7-6.5 6.6V20l2.2-1.6L10 20.2 12.2 18l2.3 2.2L16.8 18.4 19 20v-10.4C19 5.7 16.2 3 12 3zm-2.4 7.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zm4.8 0a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM9.2 14.2c.7 1.3 1.7 1.9 2.8 1.9s2.1-.6 2.8-1.9" },
  play: { fill: true, d: "M8 5.2v13.6L19 12 8 5.2z" },
  pause: { fill: true, d: "M6.5 5h3.2v14H6.5zm7.8 0H17.5v14h-3.2z" },
  prev: { fill: true, d: "M6 5h2.2v14H6zm12.2 0L9.6 12l8.6 7z" },
  next: { fill: true, d: "M16 5h2.2v14H16zM6 5l8.6 7L6 19z" },
  eye: { d: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" },
  motion: { d: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" },
  sound: { d: "M4 10h3l4-3.5v11L7 14H4z M14 9.5a3.5 3.5 0 0 1 0 5 M16.5 7a6.5 6.5 0 0 1 0 10" },
  muted: { d: "M4 10h3l4-3.5v11L7 14H4z M15 10l5 5 M20 10l-5 5" },
  link: { d: "M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1 M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" },
  discord: { d: "M7.2 8.2A8 8 0 0 1 12 7a8 8 0 0 1 4.8 1.2 M8.2 16.2c.9.7 2.2 1.1 3.8 1.1s2.9-.4 3.8-1.1 M8.7 12h.01 M15.3 12h.01 M6 16.5 4.8 18.8c2.4 1.4 5 1.6 7.2.2 2.2 1.4 4.8 1.2 7.2-.2L18 16.5" },
  youtube: { d: "M4 8.5A3 3 0 0 1 7 5.5h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z M11 9.5l4.2 2.5L11 14.5z" },
  tiktok: { d: "M14 6c.6 2.2 2 3.4 4 3.6v2.4c-1.4 0-2.7-.4-4-1.2v5.2a4.8 4.8 0 1 1-4.8-4.8c.3 0 .6 0 .8.1v2.5a2.4 2.4 0 1 0 1.6 2.3V6z" },
  x: { d: "M5 5l14 14 M19 5 5 19" },
  instagram: { d: "M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z M17.2 6.8h.01" },
  twitch: { d: "M6 4h12v10l-3 3h-3l-2 2H8v-2H6z M10 8v5 M14 8v5" },
  github: { d: "M9 18c-3 .8-3-1.5-4-2 M15 20v-2.2a2.4 2.4 0 0 0-.7-1.8c2.2-.2 4.5-1.1 4.5-5a3.8 3.8 0 0 0-1-2.6 3.5 3.5 0 0 0-.1-2.6s-.8-.3-2.7 1a9.3 9.3 0 0 0-5 0c-1.9-1.3-2.7-1-2.7-1a3.5 3.5 0 0 0-.1 2.6 3.8 3.8 0 0 0-1 2.6c0 3.9 2.3 4.8 4.5 5a2.4 2.4 0 0 0-.7 1.8V20" },
  spotify: { d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M7.5 10.2c3.2-1 6.6-.7 9.2.8 M8 13c2.6-.8 5.2-.5 7.4.7 M8.6 15.6c2-.6 4-.3 5.6.5" }
};

export function svgIcon(name) {
  const spec = ICONS[name] || ICONS.link;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ico");
  if (spec.fill) {
    svg.setAttribute("fill", "currentColor");
  } else {
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
  }
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", spec.d);
  if (!spec.fill) path.setAttribute("fill", "none");
  svg.append(path);
  return svg;
}

export function ghostMark() {
  const svg = svgIcon("ghost");
  svg.classList.add("ghost-mark");
  return svg;
}
