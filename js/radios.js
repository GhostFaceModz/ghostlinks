/** Single-select groups: role="radio" + aria-checked, with arrow keys. */

export function bindRadioGroup(group) {
  const radios = () => [...group.querySelectorAll('[role="radio"]')];

  function sync(current) {
    for (const node of radios()) {
      const on = node === current;
      node.setAttribute("aria-checked", on ? "true" : "false");
      node.tabIndex = on ? 0 : -1;
    }
  }

  group.addEventListener("click", (event) => {
    const radio = event.target.closest('[role="radio"]');
    if (!radio || !group.contains(radio)) return;
    sync(radio);
  });

  group.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const list = radios();
    const index = list.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = list[(index + delta + list.length) % list.length];
    next.click();
    next.focus();
  });

  const chosen = radios().find((node) => node.getAttribute("aria-checked") === "true") || radios()[0];
  if (chosen) sync(chosen);
}
