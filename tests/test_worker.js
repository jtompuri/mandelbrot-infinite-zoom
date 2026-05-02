// Unit tests for worker.js math/color functions.
// Loads worker.js into a sandboxed VM context with stubbed Web Worker globals,
// then exercises individual functions directly.
//
// Run with:  node --test tests/test_worker.js

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const workerSource = fs.readFileSync(
  path.join(__dirname, "..", "worker.js"),
  "utf8",
);

const sandbox = {
  self: { onmessage: null, postMessage: () => {} },
  performance: { now: () => 0 },
  MessageChannel: class {
    constructor() {
      this.port1 = { onmessage: null };
      this.port2 = { postMessage: () => {} };
    }
  },
  Math,
  Map,
  Uint8ClampedArray,
  Uint32Array,
  Boolean,
  Number,
  console,
};
vm.createContext(sandbox);
vm.runInContext(workerSource, sandbox);

const {
  mix,
  smoothstep,
  colorAt,
  isProbablyInside,
  packedColor,
  paletteLut,
  mandelbrotColor,
  colorDistance,
  sampleAt,
  shouldSkipSupersample,
  boxFilterAverage,
} = sandbox;

const INSIDE_RGB = (2 << 16) | (3 << 8) | 8;

const r = (color) => (color >> 16) & 255;
const g = (color) => (color >> 8) & 255;
const b = (color) => color & 255;

describe("mix", () => {
  it("returns endpoints at t=0 and t=1", () => {
    assert.equal(mix(10, 20, 0), 10);
    assert.equal(mix(10, 20, 1), 20);
  });

  it("linearly interpolates at t=0.5", () => {
    assert.equal(mix(0, 100, 0.5), 50);
    assert.equal(mix(-50, 50, 0.5), 0);
  });
});

describe("smoothstep", () => {
  it("anchors at 0 and 1", () => {
    assert.equal(smoothstep(0), 0);
    assert.equal(smoothstep(1), 1);
  });

  it("equals 0.5 at midpoint", () => {
    assert.equal(smoothstep(0.5), 0.5);
  });

  it("has zero derivative at endpoints (smooth easing)", () => {
    const eps = 1e-6;
    assert.ok(smoothstep(eps) < eps, "near-zero slope at t=0");
    assert.ok(1 - smoothstep(1 - eps) < eps, "near-zero slope at t=1");
  });
});

describe("colorAt", () => {
  // Run in sandbox to ensure stops are constructed with the same Array realm
  // as the function under test (cross-realm deepEqual is unreliable).
  const stops = vm.runInContext(
    `[[0.0, [0,0,0]], [0.5, [128,64,32]], [1.0, [255,255,255]]]`,
    sandbox,
  );
  const toPlain = (rgb) => [rgb[0], rgb[1], rgb[2]];

  it("returns first stop color at t=0", () => {
    assert.deepEqual(toPlain(colorAt(0, stops)), [0, 0, 0]);
  });

  it("returns last stop color at t=1", () => {
    assert.deepEqual(toPlain(colorAt(1, stops)), [255, 255, 255]);
  });

  it("clamps t to [0,1]", () => {
    assert.deepEqual(toPlain(colorAt(-0.5, stops)), [0, 0, 0]);
    assert.deepEqual(toPlain(colorAt(1.5, stops)), [255, 255, 255]);
  });

  it("hits midpoint stop exactly at its t value", () => {
    assert.deepEqual(toPlain(colorAt(0.5, stops)), [128, 64, 32]);
  });
});

describe("isProbablyInside", () => {
  it("recognises origin as inside main cardioid", () => {
    assert.equal(isProbablyInside(0, 0), true);
  });

  it("recognises (-1, 0) as inside period-2 bulb", () => {
    assert.equal(isProbablyInside(-1, 0), true);
  });

  it("does NOT recognise faraway points as inside", () => {
    assert.equal(isProbablyInside(2, 0), false);
    assert.equal(isProbablyInside(-2, 1), false);
    assert.equal(isProbablyInside(0.5, 0.5), false);
  });

  it("rejects edge of main cardioid (epsilon outside)", () => {
    // Cardioid cusp is at (0.25, 0); just past it should be outside.
    assert.equal(isProbablyInside(0.3, 0), false);
  });
});

describe("colorDistance", () => {
  it("returns 0 for identical colors", () => {
    assert.equal(colorDistance(0xabcdef, 0xabcdef), 0);
    assert.equal(colorDistance(0, 0), 0);
  });

  it("computes L1 distance across channels", () => {
    // (255,0,0) vs (0,255,0)  →  255+255+0 = 510
    assert.equal(colorDistance(0xff0000, 0x00ff00), 510);
  });

  it("is symmetric", () => {
    const a = 0x102030;
    const b = 0x405060;
    assert.equal(colorDistance(a, b), colorDistance(b, a));
  });
});

describe("paletteLut", () => {
  it("returns Uint32Array of size 2048", () => {
    const lut = paletteLut("clearsky");
    assert.ok(lut instanceof sandbox.Uint32Array);
    assert.equal(lut.length, 2048);
  });

  it("caches by name (returns same instance on second call)", () => {
    const a = paletteLut("magma");
    const b = paletteLut("magma");
    assert.equal(a, b);
  });

  it("falls back to aurora for unknown colormaps", () => {
    const aurora = paletteLut("aurora");
    const fallback = paletteLut("does-not-exist");
    assert.deepEqual(Array.from(fallback), Array.from(aurora));
  });
});

describe("packedColor", () => {
  it("returns a value present in the LUT", () => {
    const lut = paletteLut("clearsky");
    const color = packedColor(10.5, lut, 1.0, 0);
    assert.ok(Array.from(lut).includes(color));
  });

  it("wraps via fractional part (period of COLOR_PERIOD=167)", () => {
    const lut = paletteLut("clearsky");
    const a = packedColor(5, lut, 1.0, 0);
    const b = packedColor(5 + 167, lut, 1.0, 0);
    assert.equal(a, b);
  });
});

describe("mandelbrotColor", () => {
  const lut = paletteLut("clearsky");

  it("returns INSIDE_RGB for origin (deep inside main cardioid)", () => {
    const color = mandelbrotColor(0, 0, 100, lut, null, 1.0, 0);
    assert.equal(color, INSIDE_RGB);
  });

  it("returns INSIDE_RGB for period-2 bulb center", () => {
    const color = mandelbrotColor(-1, 0, 100, lut, null, 1.0, 0);
    assert.equal(color, INSIDE_RGB);
  });

  it("returns a non-INSIDE color for faraway escape point", () => {
    const color = mandelbrotColor(2, 2, 100, lut, null, 1.0, 0);
    assert.notEqual(color, INSIDE_RGB);
    // Color must be a valid RGB packed into 24 bits.
    assert.ok(color >= 0 && color <= 0xffffff);
  });

  it("populates centroid stats on escaping pixels", () => {
    const centroid = {
      xSum: 0,
      ySum: 0,
      wSum: 0,
      count: 0,
      pixels: 0,
      bounded: 0,
    };
    mandelbrotColor(0.5, 0.5, 100, lut, centroid, 1.0, 0);
    assert.ok(centroid.count > 0, "boundary samples should accrue");
    assert.ok(centroid.wSum > 0);
  });

  it("does NOT mutate centroid when null", () => {
    // Just verify no throw.
    mandelbrotColor(0.5, 0.5, 100, lut, null, 1.0, 0);
  });
});

describe("sampleAt", () => {
  const lut = paletteLut("clearsky");

  it("forwards all job fields and respects withCentroid flag", () => {
    const job = {
      maxIter: 50,
      lut,
      centroid: {
        xSum: 0,
        ySum: 0,
        wSum: 0,
        count: 0,
        pixels: 0,
        bounded: 0,
      },
      colorDensity: 1.0,
      gradientOffset: 0,
    };
    // Inside point with centroid: bounded should increment.
    sampleAt(job, 0, 0, true);
    assert.equal(job.centroid.bounded, 1);
  });

  it("does NOT touch centroid when withCentroid=false", () => {
    const job = {
      maxIter: 50,
      lut,
      centroid: {
        xSum: 0,
        ySum: 0,
        wSum: 0,
        count: 0,
        pixels: 0,
        bounded: 0,
      },
      colorDensity: 1.0,
      gradientOffset: 0,
    };
    sampleAt(job, 0, 0, false);
    assert.equal(job.centroid.bounded, 0);
  });

  it("returns INSIDE_RGB for inside coordinates", () => {
    const job = {
      maxIter: 50,
      lut,
      centroid: null,
      colorDensity: 1.0,
      gradientOffset: 0,
    };
    assert.equal(sampleAt(job, 0, 0, false), INSIDE_RGB);
  });
});

describe("shouldSkipSupersample", () => {
  const lut = paletteLut("clearsky");

  function makeJob(centerX, centerY, dx, dy) {
    return {
      maxIter: 200,
      lut,
      centroid: null,
      colorDensity: 1.0,
      gradientOffset: 0,
      dx,
      dy,
    };
  }

  it("returns true for flat interior region (all INSIDE_RGB)", () => {
    const job = makeJob(0, 0, 0.001, 0.001);
    const centerColor = sampleAt(job, 0, 0, false);
    // Center is well inside the main cardioid; all probes will be INSIDE_RGB.
    assert.equal(shouldSkipSupersample(job, centerColor, 0, 0), true);
  });

  it("returns false at cardioid boundary (mixed inside/outside probes)", () => {
    // Center at origin (INSIDE_RGB), dx large enough that probes at 0.45*dx
    // land outside the cardioid → INSIDE_RGB vs escape colors → max contrast.
    const job = makeJob(0, 0, 1.0, 1.0);
    const centerColor = sampleAt(job, 0, 0, false);
    assert.equal(centerColor, INSIDE_RGB);
    assert.equal(shouldSkipSupersample(job, centerColor, 0, 0), false);
  });
});

describe("boxFilterAverage", () => {
  const lut = paletteLut("clearsky");

  it("writes INSIDE_RGB-equivalent bytes for fully-interior pixel", () => {
    const data = new Uint8ClampedArray(4);
    const job = {
      data,
      maxIter: 100,
      lut,
      centroid: null,
      colorDensity: 1.0,
      gradientOffset: 0,
      dx: 1e-6,
      dy: 1e-6,
      samples: 2,
    };
    boxFilterAverage(job, 0, 0, 0);
    assert.equal(data[0], r(INSIDE_RGB));
    assert.equal(data[1], g(INSIDE_RGB));
    assert.equal(data[2], b(INSIDE_RGB));
    assert.equal(data[3], 255);
  });

  it("averages output bytes are in valid 0–255 range", () => {
    const data = new Uint8ClampedArray(4);
    const job = {
      data,
      maxIter: 200,
      lut,
      centroid: null,
      colorDensity: 1.0,
      gradientOffset: 0,
      dx: 1e-3,
      dy: 1e-3,
      samples: 3,
    };
    boxFilterAverage(job, 0, -0.5, 0); // near boundary, varied colors
    for (let i = 0; i < 3; i++) {
      assert.ok(data[i] >= 0 && data[i] <= 255);
    }
    assert.equal(data[3], 255);
  });
});
