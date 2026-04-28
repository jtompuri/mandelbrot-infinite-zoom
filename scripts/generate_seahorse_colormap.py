#!/usr/bin/env python3
"""Generate a seahorse-style colormap image in images/colormap-examples.

Run from project root:

    python3 scripts/generate_seahorse_colormap.py

This script writes images/colormap-examples/seahorse-colormap.png
and prints the stop list suitable for insertion into `static/worker.js`.
"""
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
OUT_DIR = BASE / "images" / "colormap-examples"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Colormap stops approximating the attached "Seahorse Valley" photo.
# Format: (position, (r,g,b))
STOPS = [
    (0.00, (8, 7, 12)),
    (0.12, (28, 32, 110)),
    (0.26, (46, 112, 205)),
    (0.42, (140, 194, 230)),
    (0.56, (230, 155, 38)),
    (0.72, (208, 80, 40)),
    (0.88, (120, 24, 46)),
    (1.00, (250, 245, 230)),
]

def lerp(a, b, t):
    return int(a + (b - a) * t)

def color_at(t):
    # find segment
    if t <= STOPS[0][0]:
        return STOPS[0][1]
    for i in range(len(STOPS)-1):
        p0, c0 = STOPS[i]
        p1, c1 = STOPS[i+1]
        if t >= p0 and t <= p1:
            local = (t - p0) / (p1 - p0) if p1 > p0 else 0
            r = lerp(c0[0], c1[0], local)
            g = lerp(c0[1], c1[1], local)
            b = lerp(c0[2], c1[2], local)
            return (r, g, b)
    return STOPS[-1][1]

def generate(width=2048, height=64, out_name="seahorse-colormap.png"):
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

    # Print stops for manual copy-paste into worker.js if desired
    js_stops = ", ".join([f"[{p:.2f}, [{c[0]}, {c[1]}, {c[2]}]]" for p, c in STOPS])
    print("\nUse the following stops in static/worker.js:\n")
    print("seahorse: [" + js_stops + "],")

if __name__ == '__main__':
    generate()
