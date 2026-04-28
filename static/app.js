const canvas = document.getElementById("fractal");
const ctx = canvas.getContext("2d", { alpha: false });
const backBuffer = document.createElement("canvas");
const backCtx = backBuffer.getContext("2d", { alpha: false });
const toolbar = document.querySelector(".toolbar");
const toggle = document.getElementById("toggle");
const collapseButton = document.getElementById("collapse");
const resetButton = document.getElementById("reset");
const saveButton = document.getElementById("save");
const zoomInButton = document.getElementById("zoom-in");
const zoomOutButton = document.getElementById("zoom-out");
const zoomResetButton = document.getElementById("zoom-reset");
const targetSelect = document.getElementById("target");
const colormapSelect = document.getElementById("colormap");
const antialiasSelect = document.getElementById("antialias");
const qualityInput = document.getElementById("quality");
const speedInput = document.getElementById("speed");
const qualityValue = document.getElementById("quality-value");
const speedValue = document.getElementById("speed-value");
const qualityReset = document.getElementById("quality-reset");
const speedReset = document.getElementById("speed-reset");
const densityInput = document.getElementById("density");
const densityValue = document.getElementById("density-value");
const densityReset = document.getElementById("density-reset");
const offsetInput = document.getElementById("offset");
const offsetValue = document.getElementById("offset-value");
const offsetReset = document.getElementById("offset-reset");
const QUALITY_DEFAULT = qualityInput.value;
const SPEED_DEFAULT = speedInput.value;
const DENSITY_DEFAULT = "1.00";
const OFFSET_DEFAULT = "0";
const meter = document.getElementById("meter");
const fps = document.getElementById("fps");
const selection = document.getElementById("selection");

const worker = new Worker("/worker.js");

let centerX = -0.743643887037151;
let centerY = 0.13182590420533;
let scale = 3.15;
let pendingHashUpdate = null;
let animating = false;
let frameTimes = [];
let renderToken = 0;
let renderStarted = 0;
let hasFullFrame = false;
let dragStart = null;
let dragCurrent = null;
let pendingCentroid = null;
function formatAaLabel(samples) {
  return samples === 1 ? "Off" : `${samples}x`;
}

function readHashState() {
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const x = Number(params.get("x"));
  const y = Number(params.get("y"));
  const s = Number(params.get("s"));
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(s) ||
    s <= 0
  )
    return null;
  return {
    x,
    y,
    s,
    q: Number(params.get("q")) || null,
    aa: Number(params.get("aa")) || null,
    c: params.get("c") || null,
    den: parseFloat(params.get("den")),
    off: parseFloat(params.get("off")),
  };
}

function applyHashState(state) {
  centerX = state.x;
  centerY = state.y;
  scale = state.s;
  if (
    state.q &&
    state.q >= Number(qualityInput.min) &&
    state.q <= Number(qualityInput.max)
  ) {
    qualityInput.value = String(state.q);
    qualityValue.textContent = qualityInput.value;
  }
  if (
    state.aa &&
    [...antialiasSelect.options].some((o) => Number(o.value) === state.aa)
  ) {
    antialiasSelect.value = String(state.aa);
  }
  if (state.c && [...colormapSelect.options].some((o) => o.value === state.c)) {
    colormapSelect.value = state.c;
  }
  if (
    !isNaN(state.den) &&
    state.den >= parseFloat(densityInput.min) &&
    state.den <= parseFloat(densityInput.max)
  ) {
    densityInput.value = String(state.den);
    densityValue.textContent = parseFloat(densityInput.value).toFixed(2);
  }
  if (
    !isNaN(state.off) &&
    state.off >= parseFloat(offsetInput.min) &&
    state.off <= parseFloat(offsetInput.max)
  ) {
    offsetInput.value = String(state.off);
    offsetValue.textContent = offsetInput.value;
  }
}

function writeHashState() {
  // Coalesce updates so rapid renders (e.g. animation) don't churn history.
  if (pendingHashUpdate !== null) return;
  pendingHashUpdate = setTimeout(() => {
    pendingHashUpdate = null;
    const params = new URLSearchParams();
    params.set("x", centerX.toPrecision(15));
    params.set("y", centerY.toPrecision(15));
    params.set("s", scale.toPrecision(8));
    params.set("q", qualityInput.value);
    params.set("aa", antialiasSelect.value);
    params.set("c", colormapSelect.value);
    params.set("den", densityInput.value);
    params.set("off", offsetInput.value);
    history.replaceState(null, "", `#${params.toString()}`);
  }, 250);
}

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(innerWidth * dpr);
  const height = Math.floor(innerHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    backBuffer.width = width;
    backBuffer.height = height;
    render();
  }
}

// Auto-scale maxIter with zoom depth. Base quality from the slider acts as
// a multiplier on a depth-based budget so that deep zooms get the iteration
// headroom they need to resolve boundary detail without saturating. The
// growth rate is intentionally gentle so interactive zoom stays responsive.
function effectiveMaxIter() {
  const base = Number(qualityInput.value);
  if (scale >= 3.15) return base;
  const depth = Math.log10(3.15 / scale);
  const factor = 1 + 0.3 * depth;
  return Math.round(base * factor);
}

function render() {
  const token = ++renderToken;
  renderStarted = performance.now();
  const samples = Number(antialiasSelect.value);
  const aaMode = "adaptive";
  const maxIter = effectiveMaxIter();
  const colorDensity = parseFloat(densityInput.value);
  const gradientOffset = parseFloat(offsetInput.value);
  meter.textContent = `rendering | ${maxIter} iterations | ${formatAaLabel(samples)} AA`;

  const params = {
    type: "render",
    token,
    width: canvas.width,
    height: canvas.height,
    centerX,
    centerY,
    scale,
    maxIter,
    samples,
    aaMode,
    colorDensity,
    gradientOffset,
    colormap: colormapSelect.value,
  };

  if (!hasFullFrame) {
    meter.textContent = `rendering preview | ${maxIter} iterations | ${formatAaLabel(samples)} AA`;
    worker.postMessage({ ...params, phase: "preview", previewScale: 4 });
  }
  worker.postMessage({ ...params, phase: "full", previewScale: 1 });
}

function updateFinalStatus(maxIter, samples) {
  const shortCenter = `${centerX.toPrecision(6)}, ${centerY.toPrecision(6)}`;
  const exactCenter = `${centerX.toPrecision(17)}, ${centerY.toPrecision(17)}`;
  meter.textContent = `scale ${scale.toExponential(3)} | center ${shortCenter} | ${maxIter} iterations | ${formatAaLabel(samples)} AA`;
  meter.title = `Exact center: ${exactCenter}\nScale: ${scale.toPrecision(17)}`;
}

function showRenderedFrame(message) {
  if (message.token !== renderToken) return;

  if (message.type === "progress") {
    meter.textContent = `rendering ${Math.round(message.progress * 100)}% | ${message.maxIter} iterations | ${formatAaLabel(message.samples)} AA`;
    return;
  }

  if (message.phase === "preview" && hasFullFrame) return;

  const pixels = new Uint8ClampedArray(message.buffer);
  const image = new ImageData(pixels, message.width, message.height);
  backBuffer.width = message.width;
  backBuffer.height = message.height;
  backCtx.putImageData(image, 0, 0);

  ctx.imageSmoothingEnabled = message.phase === "preview";
  ctx.drawImage(backBuffer, 0, 0, canvas.width, canvas.height);

  const elapsed = performance.now() - renderStarted;
  const phaseLabel = message.phase === "preview" ? "preview" : "full";
  meter.textContent = `${phaseLabel} ${Math.round(elapsed)} ms | ${message.maxIter} iterations | ${formatAaLabel(message.samples)} AA`;

  if (message.phase !== "full") return;

  hasFullFrame = true;
  pendingCentroid = message.centroid || null;
  frameTimes.push(elapsed);
  if (frameTimes.length > 16) frameTimes.shift();
  const average = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  fps.textContent = `${(1000 / average).toFixed(1)} fps`;
  updateFinalStatus(message.maxIter, message.samples);
  writeHashState();

  if (animating) requestAnimationFrame(zoomStep);
}

function zoomStep() {
  const speed = Number(speedInput.value) / 100;
  const centroid = pendingCentroid;
  pendingCentroid = null;

  // Pan toward the boundary-band centroid when one is available, then
  // zoom in. If a frame produces no usable centroid (e.g. featureless
  // dive), we just keep the current center and zoom anyway; the user
  // can pause or recenter manually.
  if (centroid !== null && centroid.x !== null) {
    const aspect = canvas.width / canvas.height;
    const viewWidth = scale * aspect;
    const viewHeight = scale;
    const dx = centroid.x - centerX;
    const dy = centroid.y - centerY;
    const maxStepX = viewWidth * 0.22;
    const maxStepY = viewHeight * 0.22;
    const stepFraction = 0.18;
    centerX += Math.max(-maxStepX, Math.min(maxStepX, dx * stepFraction));
    centerY += Math.max(-maxStepY, Math.min(maxStepY, dy * stepFraction));
  }

  scale *= 0.985 - speed * 0.205;
  if (scale < 1e-15) scale = 3.15;

  render();
}

function setTarget(value) {
  hasFullFrame = false;
  const [x, y, nextScale] = value.split(",").map(Number);
  centerX = x;
  centerY = y;
  scale = nextScale;
  render();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function recenterAt(point, shouldRender = true) {
  hasFullFrame = false;
  centerX +=
    (point.x / point.width - 0.5) * scale * (canvas.width / canvas.height);
  centerY += (point.y / point.height - 0.5) * scale;
  if (shouldRender) render();
}

function selectionRect() {
  const rect = canvas.getBoundingClientRect();
  const startX = dragStart.x + rect.left;
  const startY = dragStart.y + rect.top;
  const currentX = dragCurrent.x + rect.left;
  const currentY = dragCurrent.y + rect.top;
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

function updateSelection() {
  if (!dragStart || !dragCurrent) return;

  const size = selectionRect();
  selection.style.display = "block";
  selection.style.left = `${size.left}px`;
  selection.style.top = `${size.top}px`;
  selection.style.width = `${size.width}px`;
  selection.style.height = `${size.height}px`;
}

function zoomToSelection() {
  hasFullFrame = false;
  if (!dragStart || !dragCurrent) return false;

  const width = Math.abs(dragCurrent.x - dragStart.x);
  const height = Math.abs(dragCurrent.y - dragStart.y);
  if (Math.max(width, height) < 8) return false;

  const rect = canvas.getBoundingClientRect();
  const x1 = Math.min(dragStart.x, dragCurrent.x);
  const x2 = Math.max(dragStart.x, dragCurrent.x);
  const y1 = Math.min(dragStart.y, dragCurrent.y);
  const y2 = Math.max(dragStart.y, dragCurrent.y);
  const selectedCenter = {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    width: rect.width,
    height: rect.height,
  };
  const horizontalScale = width / rect.width;
  const verticalScale = height / rect.height;

  recenterAt(selectedCenter, false);
  scale *= Math.max(horizontalScale, verticalScale);
  render();
  return true;
}

function clearSelection() {
  selection.style.display = "none";
  dragStart = null;
  dragCurrent = null;
}

worker.addEventListener("message", (event) => showRenderedFrame(event.data));

toggle.addEventListener("click", () => {
  animating = !animating;
  toggle.textContent = animating ? "Pause" : "Play";
  if (animating) {
    zoomStep();
  } else {
    render();
  }
});

collapseButton.addEventListener("click", () => {
  const collapsed = toolbar.classList.toggle("collapsed");
  collapseButton.textContent = collapsed ? "+" : "-";
  collapseButton.title = collapsed ? "Show controls" : "Hide controls";
  collapseButton.setAttribute(
    "aria-label",
    collapsed ? "Show controls" : "Hide controls",
  );
});
resetButton.addEventListener("click", () => setTarget(targetSelect.value));

function buildSaveFilename() {
  const slugify = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const targetSlug = slugify(
    targetSelect.options[targetSelect.selectedIndex]?.text || "",
  );
  const colormapSlug = slugify(colormapSelect.value || "");
  const quality = qualityInput.value;
  const parts = ["mandelbrot"];
  if (targetSlug) parts.push(targetSlug);
  if (colormapSlug) parts.push(colormapSlug);
  if (quality) parts.push(`q${quality}`);
  return `${parts.join("-")}.png`;
}

saveButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = buildSaveFilename();
  link.href = canvas.toDataURL("image/png");
  link.click();
});

function zoomBy(factor) {
  scale *= factor;
  if (scale > 3.15) scale = 3.15;
  if (scale < 1e-15) scale = 1e-15;
  render();
}

zoomInButton.addEventListener("click", () => zoomBy(0.5));
zoomOutButton.addEventListener("click", () => zoomBy(2));
zoomResetButton.addEventListener("click", () => {
  scale = 3.15;
  render();
});

function panBy(fractionX, fractionY) {
  const aspect = canvas.width / canvas.height;
  centerX += fractionX * scale * aspect;
  centerY += fractionY * scale;
  render();
}

addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement
  )
    return;
  const step = event.shiftKey ? 0.2 : 0.05;
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    zoomBy(0.5);
  } else if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    zoomBy(2);
  } else if (event.key === "0") {
    event.preventDefault();
    scale = 3.15;
    render();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    panBy(-step, 0);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    panBy(step, 0);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    panBy(0, -step);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    panBy(0, step);
  }
});

targetSelect.addEventListener("change", () => setTarget(targetSelect.value));
colormapSelect.addEventListener("change", render);
antialiasSelect.addEventListener("change", render);
densityInput.addEventListener("input", () => {
  densityValue.textContent = parseFloat(densityInput.value).toFixed(2);
  render();
});
offsetInput.addEventListener("input", () => {
  offsetValue.textContent = offsetInput.value;
  render();
});
qualityInput.addEventListener("input", () => {
  qualityValue.textContent = qualityInput.value;
  render();
});
speedInput.addEventListener("input", () => {
  speedValue.textContent = speedInput.value;
});
qualityReset.addEventListener("click", () => {
  qualityInput.value = QUALITY_DEFAULT;
  qualityValue.textContent = QUALITY_DEFAULT;
  render();
});
speedReset.addEventListener("click", () => {
  speedInput.value = SPEED_DEFAULT;
  speedValue.textContent = SPEED_DEFAULT;
});
densityReset.addEventListener("click", () => {
  densityInput.value = DENSITY_DEFAULT;
  densityValue.textContent = DENSITY_DEFAULT;
  render();
});
offsetReset.addEventListener("click", () => {
  offsetInput.value = OFFSET_DEFAULT;
  offsetValue.textContent = OFFSET_DEFAULT;
  render();
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  dragStart = canvasPoint(event);
  dragCurrent = dragStart;
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragStart) return;
  dragCurrent = canvasPoint(event);
  updateSelection();
});

canvas.addEventListener("pointerup", (event) => {
  if (!dragStart) return;
  dragCurrent = canvasPoint(event);
  const zoomed = zoomToSelection();
  if (!zoomed) recenterAt(dragCurrent);
  clearSelection();
});

canvas.addEventListener("pointercancel", () => clearSelection());

canvas.addEventListener(
  "wheel",
  (event) => {
    hasFullFrame = false;
    event.preventDefault();
    scale *= event.deltaY < 0 ? 0.76 : 1.28;
    render();
  },
  { passive: false },
);

addEventListener("resize", fitCanvas);

const initialHashState = readHashState();
if (initialHashState !== null) {
  applyHashState(initialHashState);
}

fitCanvas();
