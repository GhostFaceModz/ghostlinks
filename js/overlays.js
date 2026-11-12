/** One canvas for particle effects, plus pointer tilt and trails.
    Phones get fewer dots. Reduced motion and the Motion button stop the loop. */

const PARTICLES = {
  snow: { lite: 16, full: 36, color: "#ffffff", speed: 0.55, drift: 0.2, size: 2.2 },
  stars: { lite: 14, full: 32, color: "#efe9ff", speed: -0.08, drift: 0.02, size: 1.6, twinkle: true },
  fireflies: { lite: 8, full: 18, color: "#e6ff8a", speed: -0.16, drift: 0.35, size: 2.4, glow: true },
  sakura: { lite: 8, full: 18, color: "#ffb7d5", speed: 0.42, drift: 0.28, size: 3.2, spin: true },
  bubbles: { lite: 7, full: 14, color: "#c9ecff", speed: -0.28, drift: 0.08, size: 5, ring: true }
};

function isLite() {
  return window.matchMedia("(hover: none), (pointer: coarse), (max-width: 700px)").matches;
}

function isFine() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function mountOverlays(host, page, card) {
  const canvas = document.createElement("canvas");
  canvas.className = "fx-particles";
  host.append(
    layer("fx-rain"),
    layer("fx-smoke"),
    layer("fx-aurora"),
    layer("fx-ghosts"),
    canvas
  );
  const ctx = canvas.getContext("2d", { alpha: true });
  let effects = [];
  let motion = true;
  let visible = true;
  let running = true;
  let frame = 0;
  let skip = false;
  let last = 0;
  let width = 1;
  let height = 1;
  let ratio = 1;
  let bits = [];
  let sparks = [];

  function resize() {
    const rect = host.getBoundingClientRect();
    const nextWidth = Math.max(1, rect.width || window.innerWidth);
    const nextHeight = Math.max(1, rect.height || window.innerHeight);
    const nextRatio = Math.min(window.devicePixelRatio || 1, isLite() ? 1.25 : 2);
    requestAnimationFrame(() => {
      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      rebuild();
    });
  }

  function rebuild() {
    const lite = isLite();
    bits = [];
    for (const id of effects) {
      const spec = PARTICLES[id];
      if (!spec) continue;
      const count = lite ? spec.lite : spec.full;
      for (let i = 0; i < count; i += 1) {
        bits.push({
          spec,
          x: Math.random() * width,
          y: Math.random() * height,
          r: spec.size * (0.6 + Math.random() * 0.8),
          p: Math.random() * Math.PI * 2,
          spin: Math.random() * 0.05
        });
      }
    }
  }

  function draw(now) {
    if (!running) return;
    frame = requestAnimationFrame(draw);
    if (!motion || !visible || document.hidden || !ctx) {
      last = now;
      return;
    }
    if (isLite() && (skip = !skip)) return;
    const delta = last ? Math.min((now - last) / 16.67, 3) : 1;
    last = now;
    ctx.clearRect(0, 0, width, height);
    for (const bit of bits) {
      const spec = bit.spec;
      bit.y += spec.speed * delta;
      bit.x += Math.sin(bit.p + bit.y * 0.01) * spec.drift * delta;
      bit.p += bit.spin * delta;
      if (bit.y < -12) bit.y = height + 8;
      if (bit.y > height + 12) bit.y = -8;
      if (bit.x < -12) bit.x = width + 8;
      if (bit.x > width + 12) bit.x = -8;
      const alpha = spec.twinkle ? 0.35 + 0.65 * Math.abs(Math.sin(bit.p + now * 0.003)) : 0.85;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = spec.color;
      ctx.strokeStyle = spec.color;
      ctx.beginPath();
      if (spec.ring) {
        ctx.arc(bit.x, bit.y, bit.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (spec.spin) {
        ctx.ellipse(bit.x, bit.y, bit.r, bit.r * 0.55, bit.p, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.arc(bit.x, bit.y, spec.glow ? bit.r * 1.4 : bit.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    sparks = sparks.filter((spark) => {
      spark.life -= 0.04 * delta;
      if (spark.life <= 0) return false;
      ctx.globalAlpha = spark.life;
      ctx.fillStyle = spark.color;
      ctx.fillRect(spark.x, spark.y, spark.size, spark.size);
      return true;
    });
    ctx.globalAlpha = 1;
  }

  let moveFrame = 0;
  let pendingMove = null;
  function onMove(event) {
    if (!motion || !isFine()) return;
    pendingMove = { x: event.clientX, y: event.clientY };
    if (moveFrame) return;
    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0;
      const point = pendingMove;
      pendingMove = null;
      if (!point) return;
      const cardBox = effects.includes("tilt") && card ? card.getBoundingClientRect() : null;
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      const wantTrail = effects.includes("trail");
      const wantSpark = effects.includes("sparkle");
      if ((wantTrail || wantSpark) && sparks.length < 80) {
        sparks.push({
          x: point.x,
          y: point.y,
          life: 1,
          size: wantSpark ? 3 : 2,
          color: wantSpark ? "#fff6c2" : "#d9ccff"
        });
      }
      if (cardBox && cardBox.width) {
        const x = (point.x - cardBox.left) / cardBox.width - 0.5;
        const y = (point.y - cardBox.top) / cardBox.height - 0.5;
        card.style.setProperty("--tilt-x", `${(-y * 6).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${(x * 8).toFixed(2)}deg`);
      }
      if (effects.includes("parallax") && viewWidth && viewHeight) {
        const x = (point.x / viewWidth - 0.5) * 16;
        const y = (point.y / viewHeight - 0.5) * 10;
        page.style.setProperty("--parallax-x", `${x.toFixed(1)}px`);
        page.style.setProperty("--parallax-y", `${y.toFixed(1)}px`);
      }
    });
  }

  function onLeave() {
    if (card) {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    }
  }

  resize();
  frame = requestAnimationFrame(draw);
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", onLeave);
  let observer;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    });
    observer.observe(host);
  }

  return {
    setEffects(next) {
      const key = next.join(",");
      if (key === effects.join(",")) return;
      effects = next.slice();
      rebuild();
    },
    setMotion(next) {
      motion = next;
      if (!next) onLeave();
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      observer?.disconnect();
    }
  };
}

function layer(className) {
  const node = document.createElement("div");
  node.className = className;
  return node;
}
