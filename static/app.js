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
const QUALITY_DEFAULT = qualityInput.value;
const SPEED_DEFAULT = speedInput.value;
const meter = document.getElementById("meter");
const fps = document.getElementById("fps");
const selection = document.getElementById("selection");

const worker = new Worker("/worker.js");

let centerX = -0.743643887037151;
let centerY = 0.13182590420533;
let scale = 3.15;
let animating = false;
let frameTimes = [];
let renderToken = 0;
let renderStarted = 0;
let hasFullFrame = false;
let dragStart = null;
let dragCurrent = null;
let pendingCentroid = null;
const benchmarkResolvers = new Map();
const productionResolvers = new Map();

function formatAaLabel(samples) {
  return samples === 1 ? "Off" : `${samples}x`;
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

function render() {
  const token = ++renderToken;
  renderStarted = performance.now();
  const samples = Number(antialiasSelect.value);
  const aaMode = "adaptive";
  meter.textContent = `rendering | ${qualityInput.value} iterations | ${formatAaLabel(samples)} AA`;

  const params = {
    type: "render",
    token,
    width: canvas.width,
    height: canvas.height,
    centerX,
    centerY,
    scale,
    maxIter: Number(qualityInput.value),
    samples,
    aaMode,
    colormap: colormapSelect.value
  };

  if (!hasFullFrame) {
    meter.textContent = `rendering preview | ${qualityInput.value} iterations | ${formatAaLabel(samples)} AA`;
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
  if (message.benchmark) {
    const resolver = benchmarkResolvers.get(message.token);
    if (resolver) {
      benchmarkResolvers.delete(message.token);
      resolver(message);
    }
    return;
  }

  if (productionResolvers.has(message.token) && message.type === "rendered" && message.phase === "full") {
    const resolver = productionResolvers.get(message.token);
    productionResolvers.delete(message.token);
    resolver(message);
    return;
  }

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
    height: rect.height
  };
}

function recenterAt(point, shouldRender = true) {
  centerX += (point.x / point.width - 0.5) * scale * (canvas.width / canvas.height);
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
    height: Math.abs(currentY - startY)
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
    height: rect.height
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

function benchmarkCase(samples, aaMode) {
  const token = `benchmark-${Date.now()}-${samples}-${aaMode}-${Math.random()}`;
  const params = {
    type: "render",
    token,
    phase: "full",
    previewScale: 1,
    width: canvas.width,
    height: canvas.height,
    centerX,
    centerY,
    scale,
    maxIter: Number(qualityInput.value),
    samples,
    aaMode,
    colormap: colormapSelect.value,
    benchmark: true,
    label: `${formatAaLabel(samples)} ${aaMode}`
  };

  return new Promise((resolve) => {
    benchmarkResolvers.set(token, resolve);
    worker.postMessage(params);
  });
}

async function runMandelbrotBenchmark(options = {}) {
  const includeFull = Boolean(options.includeFull);
  const cases = [
    [1, "adaptive"],
    [2, "adaptive"],
    [3, "adaptive"],
    [4, "adaptive"]
  ];
  if (includeFull) {
    cases.push([2, "full"], [3, "full"], [4, "full"]);
  } else {
    console.info("Benchmarking adaptive AA presets only. Use runMandelbrotBenchmarkWithFull() to include full AA reference cases.");
  }
  const results = [];

  for (const [samples, aaMode] of cases) {
    const result = await benchmarkCase(samples, aaMode);
    const stats = result.stats;
    results.push({
      case: result.label,
      ms: Math.round(result.elapsed),
      callsPerPixel: Number((stats.mandelbrotCalls / stats.pixels).toFixed(2)),
      avgIterations: Number((stats.totalIterations / Math.max(1, stats.mandelbrotCalls)).toFixed(1)),
      aaFlatSkipped: stats.aaFlatSkipped,
      aaEdgeRejected: stats.aaEdgeRejected,
      aaFullSampled: stats.aaFullSampled,
      interiorSkipped: stats.interiorSkipped,
      escaped: stats.escaped,
      bounded: stats.bounded
    });
  }

  console.table(results);
  return results;
}

window.runMandelbrotBenchmark = runMandelbrotBenchmark;
window.runMandelbrotBenchmarkWithFull = () => runMandelbrotBenchmark({ includeFull: true });

function productionCase(samples) {
  const token = `production-${Date.now()}-${samples}-${Math.random()}`;
  const params = {
    type: "render",
    token,
    phase: "full",
    previewScale: 1,
    width: canvas.width,
    height: canvas.height,
    centerX,
    centerY,
    scale,
    maxIter: Number(qualityInput.value),
    samples,
    aaMode: "adaptive",
    colormap: colormapSelect.value
  };

  return new Promise((resolve) => {
    productionResolvers.set(token, resolve);
    worker.postMessage(params);
  });
}

async function runProductionBenchmark() {
  const cases = [1, 2, 3, 4];
  const results = [];

  for (const samples of cases) {
    const result = await productionCase(samples);
    results.push({
      case: `${formatAaLabel(samples)} adaptive`,
      ms: Math.round(result.elapsed)
    });
  }

  console.table(results);
  return results;
}

window.runProductionBenchmark = runProductionBenchmark;

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
  collapseButton.setAttribute("aria-label", collapsed ? "Show controls" : "Hide controls");
});
resetButton.addEventListener("click", () => setTarget(targetSelect.value));

function buildSaveFilename() {
  const slugify = (text) => text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const targetSlug = slugify(targetSelect.options[targetSelect.selectedIndex]?.text || "");
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

addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
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
  }
});

targetSelect.addEventListener("change", () => setTarget(targetSelect.value));
colormapSelect.addEventListener("change", render);
antialiasSelect.addEventListener("change", render);
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

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  scale *= event.deltaY < 0 ? 0.76 : 1.28;
  render();
}, { passive: false });

addEventListener("resize", fitCanvas);
fitCanvas();
