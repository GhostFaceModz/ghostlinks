/** Animated backgrounds. Canvas work stays light on phones: fewer dots,
    a pre-rendered sprite (no per-dot shadowBlur), and 30fps. */

function liteQuery() {
  return window.matchMedia("(hover: none), (pointer: coarse), (max-width: 700px)");
}

export function isLiteDevice() {
  return liteQuery().matches;
}

function makeSprite(color, ratio) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(size * ratio);
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.scale(ratio, ratio);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.22, color);
  grad.addColorStop(0.45, hexFade(color, 0.25));
  grad.addColorStop(1, hexFade(color, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  g.fill();
  return canvas;
}

function hexFade(hex, alpha) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return `rgba(200,190,255,${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function readAccent(scene) {
  const raw = getComputedStyle(scene).getPropertyValue("--accent").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : "#8f6cff";
}

function mountCanvas(scene, kind) {
  const canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  scene.append(canvas);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return { stop() {}, setMotion() {}, setVisible() {} };

  const lite = isLiteDevice();
  let width = 1;
  let height = 1;
  let ratio = 1;
  let particles = [];
  let violetSprite = null;
  let cyanSprite = null;
  let sprite = null;
  let running = true;
  let frame = 0;
  let last = 0;
  let skip = false;
  let motionOn = true;
  let visible = true;
  let shooting = [];
  let nextShot = 2000;
  const accent = kind === "embers" ? readAccent(scene) : "#8f6cff";

  function resize() {
    const rect = scene.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    ratio = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    violetSprite = makeSprite("#8f6cff", ratio);
    cyanSprite = makeSprite("#36c8ff", ratio);
    sprite = kind === "embers" ? makeSprite(accent, ratio) : violetSprite;
    const count = kind === "embers" ? (lite ? 14 : 28) : (lite ? 26 : 64);
    particles = Array.from({ length: count }, () => spawn(true));
  }

  function spawn(anywhere) {
    if (kind === "embers") {
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : height + 8,
        r: Math.random() * 1.8 + 0.6,
        speed: Math.random() * 0.45 + 0.15,
        drift: Math.random() * Math.PI * 2,
        alpha: Math.random() * 0.22 + 0.08,
        tint: Math.random() > 0.45 ? "cyan" : "violet"
      };
    }
    return {
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : height + 6,
      r: Math.random() * 1.4 + 0.3,
      speed: Math.random() * 0.18 + 0.05,
      drift: Math.random() * Math.PI * 2,
      alpha: Math.random() * 0.2 + 0.06,
      tint: Math.random() > 0.45 ? "cyan" : "violet",
      phase: Math.random() * Math.PI * 2
    };
  }

  function drawShooting(delta) {
    if (kind !== "stars") return;
    nextShot -= delta * 16.67;
    if (nextShot <= 0) {
      nextShot = 4000 + Math.random() * 5000;
      const angle = Math.PI * (0.15 + Math.random() * 0.12);
      shooting.push({
        x: Math.random() * width * 0.85,
        y: Math.random() * height * 0.4,
        vx: Math.cos(angle) * 9,
        vy: Math.sin(angle) * 9,
        life: 1
      });
    }
    shooting = shooting.filter((star) => {
      star.x += star.vx * delta;
      star.y += star.vy * delta;
      star.life -= 0.02 * delta;
      if (star.life <= 0) return false;
      const grad = ctx.createLinearGradient(star.x, star.y, star.x - star.vx * 10, star.y - star.vy * 10);
      grad.addColorStop(0, `rgba(255,255,255,${Math.max(star.life, 0)})`);
      grad.addColorStop(1, "rgba(185,166,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(star.x - star.vx * 10, star.y - star.vy * 10);
      ctx.stroke();
      return true;
    });
  }

  function frameDraw(now) {
    if (!running) return;
    frame = requestAnimationFrame(frameDraw);
    if (!motionOn || !visible || document.hidden) {
      last = now;
      return;
    }
    if (lite && (skip = !skip)) return;
    const delta = last ? Math.min((now - last) / 16.67, 3) : 1;
    last = now;
    ctx.clearRect(0, 0, width, height);
    for (const particle of particles) {
      if (kind === "embers") {
        particle.y -= particle.speed * delta;
        particle.x += Math.sin(particle.drift + particle.y * 0.01) * 0.25 * delta;
        if (particle.y < -10) Object.assign(particle, spawn(false));
      } else {
        particle.y -= particle.speed * delta;
        particle.x += Math.sin(particle.drift) * 0.08 * delta;
        if (particle.y < -8) Object.assign(particle, spawn(false));
      }
      const twinkle = kind === "stars" ? 0.55 + 0.45 * Math.sin(particle.phase + now * 0.002) : 0.85;
      const size = 8 + particle.r * 6;
      const dot = kind === "embers" ? sprite : (particle.tint === "cyan" ? cyanSprite : violetSprite);
      if (dot) {
        ctx.globalAlpha = particle.alpha * twinkle;
        ctx.drawImage(dot, particle.x - size / 2, particle.y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
    drawShooting(delta);
  }

  resize();
  requestAnimationFrame(resize);
  frame = requestAnimationFrame(frameDraw);
  const onResize = () => resize();
  window.addEventListener("resize", onResize, { passive: true });

  return {
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    },
    setMotion(value) { motionOn = value; },
    setVisible(value) { visible = value; }
  };
}

function addRain(scene) {
  const lite = isLiteDevice();
  const count = lite ? 10 : 18;
  const layer = document.createElement("div");
  layer.className = "rain";
  for (let i = 0; i < count; i += 1) {
    const drop = document.createElement("span");
    drop.style.left = `${(i + 0.5) * (100 / count)}%`;
    drop.style.animationDelay = `${(-i * 0.37).toFixed(2)}s`;
    drop.style.animationDuration = `${lite ? 1.8 : 1.35 + (i % 4) * 0.18}s`;
    layer.append(drop);
  }
  scene.append(layer);
}

function addAurora(scene) {
  const mesh = document.createElement("div");
  mesh.className = "nebula";
  scene.append(mesh);
  return mountCanvas(scene, "stars");
}

function addGrid(scene) {
  const grid = document.createElement("div");
  grid.className = "grid-floor";
  scene.append(grid);
}

export function mountBackground(scene, name) {
  scene.replaceChildren();
  scene.dataset.bg = BACKGROUNDS_SAFE(name);
  let canvasApi = null;
  if (scene.dataset.bg === "aurora") canvasApi = addAurora(scene);
  else if (scene.dataset.bg === "stars") canvasApi = mountCanvas(scene, "stars");
  else if (scene.dataset.bg === "embers") canvasApi = mountCanvas(scene, "embers");
  else if (scene.dataset.bg === "rain") addRain(scene);
  else if (scene.dataset.bg === "grid") addGrid(scene);
  const vignette = document.createElement("div");
  vignette.className = "vignette";
  scene.append(vignette);

  let observer;
  if (canvasApi && "IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      canvasApi.setVisible(entries.some((entry) => entry.isIntersecting));
    }, { threshold: 0.01 });
    observer.observe(scene);
  }

  return {
    stop() {
      canvasApi?.stop();
      observer?.disconnect();
    },
    setMotion(value) {
      canvasApi?.setMotion(value);
    }
  };
}

function BACKGROUNDS_SAFE(name) {
  return ["aurora", "stars", "rain", "grid", "embers", "still"].includes(name) ? name : "aurora";
}
