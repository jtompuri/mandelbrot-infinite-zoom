#!/usr/bin/env python3
"""Generate a Sunset-style colormap image in images/colormap-examples.

Run from project root:

    python3 scripts/generate_sunset_colormap.py

This script writes images/colormap-examples/sunset-colormap.png
and prints the stop list suitable for insertion into `static/worker.js`.
"""
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
OUT_DIR = BASE / "images" / "colormap-examples"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Stops tuned against the Ultra Fractal reference image.
# Format: (position, (r,g,b))
STOPS = [
    (0.00, (2, 4, 14)),
    (0.08, (8, 18, 70)),
    (0.18, (20, 70, 170)),
    (0.30, (35, 150, 210)),
    (0.42, (125, 205, 235)),
    (0.55, (230, 245, 245)),
    (0.66, (255, 225, 130)),
    (0.78, (255, 175, 60)),
    (0.90, (240, 115, 30)),
    (1.00, (205, 70, 25)),
]

def lerp(a, b, t):
    return int(a + (b - a) * t)

def color_at(t):
    if t <= STOPS[0][0]:
        return STOPS[0][1]
    for i in range(len(STOPS) - 1):
        p0, c0 = STOPS[i]
        p1, c1 = STOPS[i + 1]
        if t >= p0 and t <= p1:
            local = (t - p0) / (p1 - p0) if p1 > p0 else 0
            r = lerp(c0[0], c1[0], local)
            g = lerp(c0[1], c1[1], local)
            b = lerp(c0[2], c1[2], local)
            return (r, g, b)
    return STOPS[-1][1]

def generate(width=2048, height=64, out_name="sunset-colormap.png"):
    img = Image.new("RGB", (width, height))
    px = img.load()
    for x in range(width):
        t = x / (width - 1)
        col = color_at(t)
        for y in range(height):
            px[x, y] = col
    out_path = OUT_DIR / out_name
    img.save(out_path)
    print(f"Wrote {out_path}")

    js_stops = ", ".join([f"[{p:.2f}, [{c[0]}, {c[1]}, {c[2]}]]" for p, c in STOPS])
    print("\nUse the following stops in static/worker.js:\n")
    print("sunset: [" + js_stops + "],")

if __name__ == '__main__':
    generate()
