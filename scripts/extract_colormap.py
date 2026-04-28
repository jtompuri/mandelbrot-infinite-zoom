#!/usr/bin/env python3
"""Extract a colormap from an image and write JS stops + gradient PNG.

Usage:
  python3 scripts/extract_colormap.py <image-path> [--name Sunset] [--colors 8]

Outputs:
 - images/colormap-examples/<name>-colormap.png
 - prints JS stops in the form: sunset: [[0.00, [r,g,b]], ...],
"""
from PIL import Image
import sys
from pathlib import Path
import random
import math


def sample_pixels(img, max_samples=5000):
    w, h = img.size
    pixels = list(img.getdata())
    total = len(pixels)
    if total <= max_samples:
        return pixels
    step = max(1, total // max_samples)
    return [pixels[i] for i in range(0, total, step)]


def rgb_luminance(c):
    r, g, b = c
    return 0.2126*r + 0.7152*g + 0.0722*b


def kmeans(colors, k=8, iterations=20):
    # colors: list of (r,g,b)
    # simple k-means with random init
    centers = random.sample(colors, k)
    for _ in range(iterations):
        buckets = [[] for _ in range(k)]
        for c in colors:
            best = 0
            bestd = float('inf')
            for i, cen in enumerate(centers):
                d = (c[0]-cen[0])**2 + (c[1]-cen[1])**2 + (c[2]-cen[2])**2
                if d < bestd:
                    bestd = d
                    best = i
            buckets[best].append(c)
        changed = False
        for i in range(k):
            if not buckets[i]:
                centers[i] = random.choice(colors)
                changed = True
                continue
            cr = sum(c[0] for c in buckets[i]) / len(buckets[i])
            cg = sum(c[1] for c in buckets[i]) / len(buckets[i])
            cb = sum(c[2] for c in buckets[i]) / len(buckets[i])
            newc = (cr, cg, cb)
            if newc != centers[i]:
                centers[i] = newc
                changed = True
        if not changed:
            break
    # convert centers to ints
    return [tuple(int(round(x)) for x in c) for c in centers]


def build_stops(centers):
    # sort centers by luminance ascending
    centers_sorted = sorted(centers, key=rgb_luminance)
    n = len(centers_sorted)
    stops = []
    for i, c in enumerate(centers_sorted):
        pos = i / (n - 1) if n > 1 else 0
        stops.append((pos, c))
    return stops


def save_gradient(stops, out_path, width=2048, height=64):
    img = Image.new('RGB', (width, height))
    px = img.load()
    for x in range(width):
        t = x / (width - 1)
        # find segment
        if t <= stops[0][0]:
            col = stops[0][1]
        else:
            col = stops[-1][1]
            for i in range(len(stops)-1):
                p0, c0 = stops[i]
                p1, c1 = stops[i+1]
                if t >= p0 and t <= p1:
                    local = (t - p0) / (p1 - p0) if (p1 - p0) > 0 else 0
                    r = int(round(c0[0] + (c1[0]-c0[0]) * local))
                    g = int(round(c0[1] + (c1[1]-c0[1]) * local))
                    b = int(round(c0[2] + (c1[2]-c0[2]) * local))
                    col = (r, g, b)
                    break
        for y in range(height):
            px[x,y] = col
    img.save(out_path)


def format_js_stops(name, stops):
    parts = []
    for p, c in stops:
        parts.append(f"[{p:.2f}, [{c[0]}, {c[1]}, {c[2]}]]")
    return f"{name}: [{', '.join(parts)}],"


def main():
    if len(sys.argv) < 2:
        print("Usage: extract_colormap.py <image-path> [--name Name] [--colors N]")
        sys.exit(1)
    img_path = Path(sys.argv[1])
    name = 'sunset'
    k = 8
    args = sys.argv[2:]
    if '--name' in args:
        i = args.index('--name')
        if i+1 < len(args):
            name = args[i+1].lower()
    if '--colors' in args:
        i = args.index('--colors')
        if i+1 < len(args):
            k = int(args[i+1])

    if not img_path.exists():
        print(f"Image not found: {img_path}")
        sys.exit(1)

    img = Image.open(img_path).convert('RGB')
    # Optionally crop to center region where gradient is likely
    w, h = img.size
    # sample central vertical band
    crop = img.crop((int(w*0.15), int(h*0.15), int(w*0.85), int(h*0.85)))
    colors = sample_pixels(crop, max_samples=8000)
    centers = kmeans(colors, k=k, iterations=30)
    stops = build_stops(centers)

    out_dir = Path(__file__).resolve().parent.parent / 'images' / 'colormap-examples'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_png = out_dir / f"{name}-colormap.png"
    save_gradient(stops, out_png)
    print(f"Wrote {out_png}")
    print('\nJS stops (paste into static/worker.js):\n')
    print(format_js_stops(name, stops))


if __name__ == '__main__':
    main()
