import math
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
OUT_DIR = BASE / "images" / "colormap-examples"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Standard Ultra Fractal 6 default background gradient
BASE_STOPS = [
    (0.0000, (0, 7, 100)),
    (0.1600, (32, 107, 203)),
    (0.4200, (237, 255, 255)),
    (0.6425, (255, 170, 0)),
    (0.8575, (0, 2, 0)),
]

def lerp(a, b, t):
    return a + (b - a) * t

def color_at_base(t):
    t = t % 1.0
    for i in range(len(BASE_STOPS)):
        p0, c0 = BASE_STOPS[i]
        p1, c1 = BASE_STOPS[(i + 1) % len(BASE_STOPS)]
        if p1 < p0:
            p1 += 1.0
        if t < p0:
            t += 1.0
        if p0 <= t <= p1:
            local = (t - p0) / (p1 - p0)
            r = int(round(lerp(c0[0], c1[0], local)))
            g = int(round(lerp(c0[1], c1[1], local)))
            b = int(round(lerp(c0[2], c1[2], local)))
            return (r, g, b)
    return BASE_STOPS[0][1]

def generate():
    # Ultra fractal screenshot shows Rotation: -52
    # Gradient has 400 positions. -52 / 400 = -0.13
    rotation = -0.13
    
    # Let's sample the rotated stops at 0, 0.03, 0.29, 0.5125, 0.7275, 0.87, 1.00
    # Wait, we can just print the points:
    shifts = [(p + rotation) % 1.0 for p, _ in BASE_STOPS]
    shifts.sort()
    
    stops = []
    for s in shifts:
        c = color_at_base(s - rotation)
        stops.append((s, c))
    
    # add end caps
    stops.insert(0, (0.0, color_at_base(-rotation)))
    stops.append((1.0, color_at_base(1.0 - rotation)))

    js_stops = ", ".join([f"[{p:.3f}, [{c[0]}, {c[1]}, {c[2]}]]" for p, c in stops])
    print("ultrafractal: [" + js_stops + "],")

    width, height = 2048, 64
    img = Image.new("RGB", (width, height))
    px = img.load()
    for x in range(width):
        t = x / (width - 1)
        col = color_at_base(t - rotation)
        for y in range(height):
            px[x, y] = col
    out_path = OUT_DIR / "ultrafractal-colormap.png"
    img.save(out_path)
    print(f"\nWrote {out_path}")

if __name__ == '__main__':
    generate()
