const INSIDE_RGB = (2 << 16) | (3 << 8) | 8;
const LUT_SIZE = 2048;
const FLAT_CONTRAST = 24;
const EDGE_CONTRAST = 72;

const colorMaps = {
  aurora: [
    [0.0, [3, 5, 14]],
    [0.12, [35, 20, 91]],
    [0.28, [36, 93, 171]],
    [0.46, [27, 185, 166]],
    [0.62, [250, 221, 132]],
    [0.78, [234, 93, 77]],
    [1.0, [250, 248, 240]],
  ],
  magma: [
    [0.0, [0, 0, 4]],
    [0.16, [44, 17, 95]],
    [0.33, [116, 31, 129]],
    [0.5, [183, 55, 121]],
    [0.67, [238, 110, 82]],
    [0.84, [252, 190, 111]],
    [1.0, [252, 253, 191]],
  ],
  inferno: [
    [0.0, [0, 0, 4]],
    [0.15, [31, 12, 72]],
    [0.32, [85, 15, 109]],
    [0.5, [187, 55, 84]],
    [0.66, [249, 142, 8]],
    [0.82, [249, 201, 50]],
    [1.0, [252, 255, 164]],
  ],
  plasma: [
    [0.0, [13, 8, 135]],
    [0.17, [84, 2, 163]],
    [0.34, [139, 10, 165]],
    [0.5, [185, 50, 137]],
    [0.67, [219, 92, 104]],
    [0.84, [244, 157, 68]],
    [1.0, [240, 249, 33]],
  ],
  viridis: [
    [0.0, [68, 1, 84]],
    [0.18, [70, 50, 126]],
    [0.36, [54, 92, 141]],
    [0.54, [39, 127, 142]],
    [0.72, [31, 161, 135]],
    [0.88, [122, 209, 81]],
    [1.0, [253, 231, 37]],
  ],
  cividis: [
    [0.0, [0, 32, 76]],
    [0.18, [38, 57, 106]],
    [0.36, [77, 82, 112]],
    [0.54, [117, 111, 105]],
    [0.72, [160, 146, 91]],
    [0.88, [208, 190, 72]],
    [1.0, [255, 233, 69]],
  ],
  turbo: [
    [0.0, [48, 18, 59]],
    [0.14, [50, 101, 213]],
    [0.28, [27, 187, 238]],
    [0.42, [76, 226, 101]],
    [0.58, [210, 226, 27]],
    [0.74, [251, 140, 21]],
    [0.88, [210, 45, 39]],
    [1.0, [122, 4, 3]],
  ],
  rocket: [
    [0.0, [3, 5, 26]],
    [0.18, [33, 18, 59]],
    [0.36, [86, 28, 80]],
    [0.54, [152, 47, 72]],
    [0.72, [215, 95, 62]],
    [0.88, [246, 169, 118]],
    [1.0, [250, 235, 221]],
  ],
  mako: [
    [0.0, [11, 4, 5]],
    [0.16, [31, 28, 55]],
    [0.34, [37, 64, 90]],
    [0.52, [35, 102, 120]],
    [0.7, [52, 148, 145]],
    [0.86, [135, 194, 161]],
    [1.0, [222, 245, 229]],
  ],
  twilight: [
    [0.0, [225, 216, 226]],
    [0.12, [173, 187, 217]],
    [0.25, [114, 145, 201]],
    [0.38, [78, 96, 168]],
    [0.5, [35, 23, 85]],
    [0.62, [82, 26, 76]],
    [0.75, [161, 65, 80]],
    [0.88, [217, 138, 117]],
    [1.0, [225, 216, 226]],
  ],
  earlysunset: [
    [0.0, [26, 88, 184]],
    [0.03, [32, 107, 203]],
    [0.29, [237, 255, 255]],
    [0.512, [255, 170, 0]],
    [0.728, [0, 2, 0]],
    [0.87, [0, 7, 100]],
    [1.0, [26, 88, 184]],
  ],
};

const paletteCache = new Map();
// Abort in-flight renders when a new request arrives.
let activeToken = 0;

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
        mix(left[1][2], right[1][2], local),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

function paletteLut(name) {
  if (paletteCache.has(name)) return paletteCache.get(name);

  const stops = colorMaps[name] || colorMaps.aurora;
  const lut = new Uint32Array(LUT_SIZE);

  // Check if the colormap is cyclic (start color matches end color)
  const first = stops[0][1];
  const last = stops[stops.length - 1][1];
  const isCyclic =
    first[0] === last[0] && first[1] === last[1] && first[2] === last[2];

  for (let i = 0; i < LUT_SIZE; i++) {
    let t = i / (LUT_SIZE - 1);

    if (!isCyclic) {
      // Mirror sequential maps (like Viridis/Magma) so they cycle gradually without a jump
      t = t * 2;
      if (t > 1) t = 2 - t;
    }

    const color = colorAt(t, stops);
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

function packedColor(smooth, lut, colorDensity, gradientOffset) {
  let t = (smooth * colorDensity + gradientOffset) / 167;
  let value = t - Math.floor(t);
  const index = Math.round(value * (LUT_SIZE - 1));
  return lut[index];
}

function writePacked(data, offset, color) {
  data[offset] = (color >> 16) & 255;
  data[offset + 1] = (color >> 8) & 255;
  data[offset + 2] = color & 255;
  data[offset + 3] = 255;
}

function mandelbrotColor(
  cx,
  cy,
  maxIter,
  lut,
  centroid,
  colorDensity,
  gradientOffset,
) {
  if (isProbablyInside(cx, cy)) {
    if (centroid !== null) centroid.bounded += 1;
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
      // Weight samples near the boundary for auto-panning.
      if (centroid !== null) {
        const t = (i + 1) / maxIter;
        if (t >= 0.05 && t <= 0.9) {
          const w = t * (1 - t);
          centroid.xSum += cx * w;
          centroid.ySum += cy * w;
          centroid.wSum += w;
          centroid.count += 1;
        }
      }
      const smooth = i + 1 - Math.log2(0.5 * Math.log2(zx2 + zy2));
      return packedColor(smooth, lut, colorDensity, gradientOffset);
    }
  }
  // Bounded pixels (inside the set).
  if (centroid !== null) centroid.bounded += 1;
  return INSIDE_RGB;
}

function colorDistance(left, right) {
  return (
    Math.abs(((left >> 16) & 255) - ((right >> 16) & 255)) +
    Math.abs(((left >> 8) & 255) - ((right >> 8) & 255)) +
    Math.abs((left & 255) - (right & 255))
  );
}

function sampleInto(job, offset, centerX, centerY) {
  const {
    data,
    dx,
    dy,
    maxIter,
    samples,
    lut,
    useAdaptive,
    centroid,
    colorDensity,
    gradientOffset,
  } = job;

  if (centroid !== null) centroid.pixels += 1;

  if (samples === 1) {
    writePacked(
      data,
      offset,
      mandelbrotColor(
        centerX,
        centerY,
        maxIter,
        lut,
        centroid,
        colorDensity,
        gradientOffset,
      ),
    );
    return;
  }

  let centerColor = 0;

  if (useAdaptive) {
    centerColor = mandelbrotColor(
      centerX,
      centerY,
      maxIter,
      lut,
      centroid,
      colorDensity,
      gradientOffset,
    );
    writePacked(data, offset, centerColor);

    const rightColor = mandelbrotColor(
      centerX + dx * 0.45,
      centerY,
      maxIter,
      lut,
      null,
      colorDensity,
      gradientOffset,
    );
    const downColor = mandelbrotColor(
      centerX,
      centerY + dy * 0.45,
      maxIter,
      lut,
      null,
      colorDensity,
      gradientOffset,
    );
    let contrast =
      colorDistance(centerColor, rightColor) +
      colorDistance(centerColor, downColor);

    if (contrast < FLAT_CONTRAST) {
      return;
    }

    if (contrast < EDGE_CONTRAST) {
      const leftColor = mandelbrotColor(
        centerX - dx * 0.45,
        centerY,
        maxIter,
        lut,
        null,
        colorDensity,
        gradientOffset,
      );
      const upColor = mandelbrotColor(
        centerX,
        centerY - dy * 0.45,
        maxIter,
        lut,
        null,
        colorDensity,
        gradientOffset,
      );
      contrast +=
        colorDistance(centerColor, leftColor) +
        colorDistance(centerColor, upColor);
      if (contrast < EDGE_CONTRAST) {
        return;
      }
    }
  }

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
      const color = mandelbrotColor(
        sampleX,
        sampleY,
        maxIter,
        lut,
        null,
        colorDensity,
        gradientOffset,
      );
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
  const maxIter =
    params.previewScale > 1
      ? Math.max(48, Math.floor(params.maxIter * 0.38))
      : params.maxIter;
  const benchmark = Boolean(params.benchmark);
  const colorDensity =
    params.colorDensity !== undefined ? params.colorDensity : 1.0;
  const gradientOffset = params.gradientOffset || 0;
  // Weighted centroid for boundary auto-panning.
  const centroid =
    !benchmark && params.previewScale <= 1
      ? { xSum: 0, ySum: 0, wSum: 0, count: 0, pixels: 0, bounded: 0 }
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
    colorDensity,
    gradientOffset,
    aaMode,
    useAdaptive: aaMode !== "full",
    centroid,
    started: performance.now(),
    y: 0,
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
  self.postMessage(
    {
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
      centroid: job.centroid
        ? {
            x:
              job.centroid.wSum > 0
                ? job.centroid.xSum / job.centroid.wSum
                : null,
            y:
              job.centroid.wSum > 0
                ? job.centroid.ySum / job.centroid.wSum
                : null,
            // Fraction of pixels in the productive boundary band.
            coverage: job.centroid.count / Math.max(1, job.centroid.pixels),
            // Fraction of pixels that never escaped (interior dive).
            bounded: job.centroid.bounded / Math.max(1, job.centroid.pixels),
          }
        : null,
      buffer: job.data.buffer,
    },
    [job.data.buffer],
  );
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
  const rowsPerChunk = Math.max(
    2,
    Math.floor(18 / (job.samples * job.samples)),
  );

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
        samples: job.samples,
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
