const INSIDE_RGB = (2 << 16) | (3 << 8) | 8;
const LUT_SIZE = 2048;
const FLAT_CONTRAST = 24;
const EDGE_CONTRAST = 72;

const colorMaps = {
  aurora: [[0.00, [3, 5, 14]], [0.12, [35, 20, 91]], [0.28, [36, 93, 171]], [0.46, [27, 185, 166]], [0.62, [250, 221, 132]], [0.78, [234, 93, 77]], [1.00, [250, 248, 240]]],
  magma: [[0.00, [0, 0, 4]], [0.16, [44, 17, 95]], [0.33, [116, 31, 129]], [0.50, [183, 55, 121]], [0.67, [238, 110, 82]], [0.84, [252, 190, 111]], [1.00, [252, 253, 191]]],
  inferno: [[0.00, [0, 0, 4]], [0.15, [31, 12, 72]], [0.32, [85, 15, 109]], [0.50, [187, 55, 84]], [0.66, [249, 142, 8]], [0.82, [249, 201, 50]], [1.00, [252, 255, 164]]],
  plasma: [[0.00, [13, 8, 135]], [0.17, [84, 2, 163]], [0.34, [139, 10, 165]], [0.50, [185, 50, 137]], [0.67, [219, 92, 104]], [0.84, [244, 157, 68]], [1.00, [240, 249, 33]]],
  viridis: [[0.00, [68, 1, 84]], [0.18, [70, 50, 126]], [0.36, [54, 92, 141]], [0.54, [39, 127, 142]], [0.72, [31, 161, 135]], [0.88, [122, 209, 81]], [1.00, [253, 231, 37]]],
  cividis: [[0.00, [0, 32, 76]], [0.18, [38, 57, 106]], [0.36, [77, 82, 112]], [0.54, [117, 111, 105]], [0.72, [160, 146, 91]], [0.88, [208, 190, 72]], [1.00, [255, 233, 69]]],
  turbo: [[0.00, [48, 18, 59]], [0.14, [50, 101, 213]], [0.28, [27, 187, 238]], [0.42, [76, 226, 101]], [0.58, [210, 226, 27]], [0.74, [251, 140, 21]], [0.88, [210, 45, 39]], [1.00, [122, 4, 3]]],
  rocket: [[0.00, [3, 5, 26]], [0.18, [33, 18, 59]], [0.36, [86, 28, 80]], [0.54, [152, 47, 72]], [0.72, [215, 95, 62]], [0.88, [246, 169, 118]], [1.00, [250, 235, 221]]],
  mako: [[0.00, [11, 4, 5]], [0.16, [31, 28, 55]], [0.34, [37, 64, 90]], [0.52, [35, 102, 120]], [0.70, [52, 148, 145]], [0.86, [135, 194, 161]], [1.00, [222, 245, 229]]]
};

const paletteCache = new Map();
// Worker tracks only the latest render token. When the main thread sends
// a newer render request, in-flight chunked renders abort on the next step
// because their token no longer matches activeToken. Benchmark and
// production-path requests bypass this by resolving directly via their own
// resolver maps in app.js, so they are not affected by token churn.
let activeToken = 0;

function createStats() {
  return {
    pixels: 0,
    mandelbrotCalls: 0,
    totalIterations: 0,
    interiorSkipped: 0,
    escaped: 0,
    bounded: 0,
    aaFlatSkipped: 0,
    aaEdgeRejected: 0,
    aaFullSampled: 0
  };
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function colorAt(t, stops) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const left = stops[i];
    const right = stops[i + 1];
    if (t >= left[0] && t <= right[0]) {
      const local = smoothstep((t - left[0]) / (right[0] - left[0]));
      return [
        mix(left[1][0], right[1][0], local),
        mix(left[1][1], right[1][1], local),
        mix(left[1][2], right[1][2], local)
      ];
    }
  }
  return stops[stops.length - 1][1];
}

function paletteLut(name) {
  if (paletteCache.has(name)) return paletteCache.get(name);

  const stops = colorMaps[name] || colorMaps.aurora;
  const lut = new Uint32Array(LUT_SIZE);
  for (let i = 0; i < LUT_SIZE; i++) {
    const color = colorAt(i / (LUT_SIZE - 1), stops);
    const r = Math.max(0, Math.min(255, Math.round(color[0])));
    const g = Math.max(0, Math.min(255, Math.round(color[1])));
    const b = Math.max(0, Math.min(255, Math.round(color[2])));
    lut[i] = (r << 16) | (g << 8) | b;
  }
  paletteCache.set(name, lut);
  return lut;
}

function isProbablyInside(cx, cy) {
  const shiftedX = cx - 0.25;
  const q = shiftedX * shiftedX + cy * cy;
  if (q * (q + shiftedX) <= 0.25 * cy * cy) return true;

  const bulbX = cx + 1;
  return bulbX * bulbX + cy * cy <= 0.0625;
}

function packedColor(smooth, maxIter, lut) {
  const wave = 0.5 + 0.5 * Math.sin(0.08 * smooth);
  const base = Math.pow(smooth / maxIter, 0.32);
  const value = Math.max(0, Math.min(1, 0.82 * base + 0.18 * wave));
  const index = Math.round(value * (LUT_SIZE - 1));
  return lut[index];
}

function writePacked(data, offset, color) {
  data[offset] = (color >> 16) & 255;
  data[offset + 1] = (color >> 8) & 255;
  data[offset + 2] = color & 255;
  data[offset + 3] = 255;
}

function mandelbrotColor(cx, cy, maxIter, lut, stats, centroid) {
  if (stats !== null) stats.mandelbrotCalls += 1;

  if (isProbablyInside(cx, cy)) {
    if (stats !== null) stats.interiorSkipped += 1;
    return INSIDE_RGB;
  }

  let zx = 0;
  let zy = 0;
  let zx2 = 0;
  let zy2 = 0;

  for (let i = 0; i < maxIter; i++) {
    zy = 2 * zx * zy + cy;
    zx = zx2 - zy2 + cx;
    zx2 = zx * zx;
    zy2 = zy * zy;

    if (zx2 + zy2 > 4) {
      if (stats !== null) {
        stats.totalIterations += i + 1;
        stats.escaped += 1;
      }
      // Only pixels close to the boundary should pull the camera. Low-iter
      // escape regions (vast featureless areas) are excluded entirely, and
      // remaining contributions are weighted quadratically so a thin
      // high-iter tendril can outweigh a large low-iter slab.
      if (centroid !== undefined && centroid !== null && i > maxIter * 0.25) {
        const w = (i + 1) * (i + 1);
        centroid.xSum += cx * w;
        centroid.ySum += cy * w;
        centroid.wSum += w;
        centroid.count += 1;
      }
      const smooth = i + 1 - Math.log2(0.5 * Math.log2(zx2 + zy2));
      return packedColor(smooth, maxIter, lut);
    }
  }

  if (stats !== null) {
    stats.totalIterations += maxIter;
    stats.bounded += 1;
  }
  return INSIDE_RGB;
}

function colorDistance(left, right) {
  return Math.abs(((left >> 16) & 255) - ((right >> 16) & 255))
    + Math.abs(((left >> 8) & 255) - ((right >> 8) & 255))
    + Math.abs((left & 255) - (right & 255));
}

function sampleInto(job, offset, centerX, centerY) {
  const { data, dx, dy, maxIter, samples, lut, useAdaptive, stats, centroid } = job;
  if (stats !== null) stats.pixels += 1;
  if (centroid !== null) centroid.pixels += 1;

  if (samples === 1) {
    writePacked(data, offset, mandelbrotColor(centerX, centerY, maxIter, lut, stats, centroid));
    return;
  }

  let centerColor = 0;

  if (useAdaptive) {
    centerColor = mandelbrotColor(centerX, centerY, maxIter, lut, stats, centroid);
    writePacked(data, offset, centerColor);

    const rightColor = mandelbrotColor(centerX + dx * 0.45, centerY, maxIter, lut, stats, null);
    const downColor = mandelbrotColor(centerX, centerY + dy * 0.45, maxIter, lut, stats, null);
    let contrast = colorDistance(centerColor, rightColor) + colorDistance(centerColor, downColor);

    if (contrast < FLAT_CONTRAST) {
      if (stats !== null) stats.aaFlatSkipped += 1;
      return;
    }

    if (contrast < EDGE_CONTRAST) {
      const leftColor = mandelbrotColor(centerX - dx * 0.45, centerY, maxIter, lut, stats, null);
      const upColor = mandelbrotColor(centerX, centerY - dy * 0.45, maxIter, lut, stats, null);
      contrast += colorDistance(centerColor, leftColor) + colorDistance(centerColor, upColor);
      if (contrast < EDGE_CONTRAST) {
        if (stats !== null) stats.aaEdgeRejected += 1;
        return;
      }
    }
  }

  if (stats !== null) stats.aaFullSampled += 1;
  let red = 0;
  let green = 0;
  let blue = 0;
  const invSamples = 1 / samples;
  const invTotal = invSamples * invSamples;
  const subStartX = centerX - 0.5 * dx;
  const subStartY = centerY - 0.5 * dy;
  const subStepX = dx * invSamples;
  const subStepY = dy * invSamples;

  for (let sy = 0; sy < samples; sy++) {
    const sampleY = subStartY + (sy + 0.5) * subStepY;
    for (let sx = 0; sx < samples; sx++) {
      const sampleX = subStartX + (sx + 0.5) * subStepX;
      const color = mandelbrotColor(sampleX, sampleY, maxIter, lut, stats, null);
      red += (color >> 16) & 255;
      green += (color >> 8) & 255;
      blue += color & 255;
    }
  }

  data[offset] = red * invTotal;
  data[offset + 1] = green * invTotal;
  data[offset + 2] = blue * invTotal;
  data[offset + 3] = 255;
}

function createRenderJob(params) {
  const width = Math.max(1, Math.floor(params.width / params.previewScale));
  const height = Math.max(1, Math.floor(params.height / params.previewScale));
  const data = new Uint8ClampedArray(width * height * 4);
  const aspect = params.width / params.height;
  const viewWidth = params.scale * aspect;
  const viewHeight = params.scale;
  const minX = params.centerX - viewWidth / 2;
  const minY = params.centerY - viewHeight / 2;
  const dx = viewWidth / Math.max(1, width - 1);
  const dy = viewHeight / Math.max(1, height - 1);
  const lut = paletteLut(params.colormap);
  const samples = params.previewScale > 1 ? 1 : params.samples;
  const maxIter = params.previewScale > 1 ? Math.max(48, Math.floor(params.maxIter * 0.38)) : params.maxIter;
  const benchmark = Boolean(params.benchmark);
  const stats = benchmark ? createStats() : null;
  // Track a weighted centroid of high-iteration escape samples on full
  // (non-preview, non-benchmark) renders. The main thread uses it during
  // animation to pan toward boundary detail and avoid drifting into
  // featureless regions.
  const centroid = (!benchmark && params.previewScale <= 1)
    ? { xSum: 0, ySum: 0, wSum: 0, count: 0, pixels: 0 }
    : null;

  const aaMode = params.aaMode || "adaptive";
  return {
    token: params.token,
    phase: params.phase,
    benchmark,
    label: params.label,
    width,
    height,
    data,
    minX,
    minY,
    dx,
    dy,
    lut,
    samples,
    maxIter,
    aaMode,
    useAdaptive: aaMode !== "full",
    stats,
    centroid,
    started: performance.now(),
    y: 0
  };
}

function renderRows(job, endY) {
  const { width, dx, dy, minX, minY } = job;
  for (; job.y < endY; job.y++) {
    let offset = job.y * width * 4;
    const cy = minY + job.y * dy;
    let cx = minX;
    for (let x = 0; x < width; x++) {
      sampleInto(job, offset, cx, cy);
      offset += 4;
      cx += dx;
    }
  }
}

function finishRender(job) {
  self.postMessage({
    type: "rendered",
    token: job.token,
    phase: job.phase,
    width: job.width,
    height: job.height,
    maxIter: job.maxIter,
    samples: job.samples,
    aaMode: job.aaMode,
    elapsed: performance.now() - job.started,
    benchmark: Boolean(job.benchmark),
    label: job.label,
    stats: job.stats,
    centroid: job.centroid && job.centroid.wSum > 0
      ? {
          x: job.centroid.xSum / job.centroid.wSum,
          y: job.centroid.ySum / job.centroid.wSum,
          // Fraction of pixels that contributed to the centroid (i.e. were
          // close enough to the boundary). Used by the main thread to
          // decide whether the view still contains enough detail.
          coverage: job.centroid.count / Math.max(1, job.centroid.pixels)
        }
      : null,
    buffer: job.data.buffer
  }, [job.data.buffer]);
}

function renderPreview(params) {
  const job = createRenderJob(params);
  renderRows(job, job.height);
  finishRender(job);
}

const yieldChannel = new MessageChannel();
const yieldQueue = [];
yieldChannel.port1.onmessage = () => {
  const next = yieldQueue.shift();
  if (next) next();
};

function scheduleYield(callback) {
  yieldQueue.push(callback);
  yieldChannel.port2.postMessage(0);
}

function renderFull(params) {
  const job = createRenderJob(params);
  const rowsPerChunk = Math.max(2, Math.floor(18 / (job.samples * job.samples)));

  function step() {
    if (job.token !== activeToken) return;

    const endY = Math.min(job.height, job.y + rowsPerChunk);
    renderRows(job, endY);

    if (job.y < job.height) {
      self.postMessage({
        type: "progress",
        token: job.token,
        progress: job.y / job.height,
        maxIter: job.maxIter,
        samples: job.samples
      });
      scheduleYield(step);
      return;
    }

    finishRender(job);
  }

  step();
}

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "render") {
    activeToken = message.token;
    if (message.phase === "preview") renderPreview(message);
    else renderFull(message);
  }
};
