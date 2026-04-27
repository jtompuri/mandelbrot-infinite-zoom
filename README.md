# Mandelbrot Infinite Zoom

![Mandelbrot overview in Aurora colormap](images/colormap-examples/mandelbrot-overview-aurora-q340.jpg)

Browser-based Mandelbrot explorer with progressive rendering, adaptive
anti-aliasing, and drag-to-zoom selection. Renders off the main thread in a
Web Worker; the Python script is just a static file server.

## About the Mandelbrot set

The Mandelbrot set is the set of complex numbers $c$ for which the iteration

$$z_{n+1} = z_n^2 + c, \quad z_0 = 0$$

stays bounded as $n \to \infty$. In practice we cap the iteration at some
maximum and treat any orbit that escapes the disk $|z| > 2$ as outside the
set; the iteration count at the moment of escape gives the colored bands.

The set was named after Benoît Mandelbrot, who studied it in the late 1970s,
though earlier work by Brooks and Matelski preceded him. It is a **fractal**:
its boundary has no smooth pieces, infinite detail at every scale, and
self-similar miniature copies of the whole set appear arbitrarily deep in
the structure. The boundary has Hausdorff dimension 2, even though it has
zero area, which is what makes "infinite zoom" so visually interesting.

Most of the visible images here render only the boundary region: pixels
that escape quickly become the colored "outside", pixels that never escape
are drawn black, and the most intricate detail lies along the thin
fractal edge between them.

## Features

- Progressive preview + full render pipeline.
- Adaptive anti-aliasing presets: Off, 2x, 3x, 4x.
- Drag-to-zoom, click-to-recenter, mouse wheel, and `+` / `−` / `1:1` buttons.
- Keyboard shortcuts: `+` / `−` to zoom, `0` to reset zoom.
- Animated infinite zoom that auto-pans toward boundary detail.
- Multiple colormaps and curated zoom targets.
- Save the current frame as PNG (filename includes the selected target,
  colormap, and quality).

## Run

```bash
python mandelbrot.py
```

Opens `http://127.0.0.1:8000/` in your browser. Use `--port`, `--host`, or
`--no-browser` to override defaults. Requires Python 3.10+ and a modern
browser; no third-party runtime dependencies.

## Development setup

A virtual environment is recommended for running tests with `pytest`:

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
```

## Tests

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

Or with `pytest` (after the development setup above):

```bash
pytest
```

## Benchmarking

From the browser DevTools console while the app is open:

- `runProductionBenchmark()` — measures the user-facing render path.
- `runMandelbrotBenchmark()` — detailed adaptive-AA benchmark with stats.
- `runMandelbrotBenchmarkWithFull()` — adds full-supersampling reference cases.

## Targets

| | | |
|---|---|---|
| ![Seahorse valley](images/target-examples/mandelbrot-seahorse-valley.jpg) Seahorse valley | ![Seahorse](images/target-examples/mandelbrot-seahorse.jpg) Seahorse | ![Seahorse spiral](images/target-examples/mandelbrot-seahorse-spiral.jpg) Seahorse spiral |
| ![Period-2 bulb](images/target-examples/mandelbrot-period-2-bulb.jpg) Period-2 bulb | ![Top bulb](images/target-examples/mandelbrot-top-bulb.jpg) Top bulb | ![Elephant valley](images/target-examples/mandelbrot-elephant-valley.jpg) Elephant valley |
| ![Triple spiral valley](images/target-examples/mandelbrot-triple-spiral-valley.jpg) Triple spiral valley | ![Spiral arms](images/target-examples/mandelbrot-spiral-arms.jpg) Spiral arms | ![Mini Mandelbrot](images/target-examples/mandelbrot-mini-mandelbrot.jpg) Mini Mandelbrot |
| ![Lightning](images/target-examples/mandelbrot-lightning.jpg) Lightning | ![Misiurewicz dendrite](images/target-examples/mandelbrot-misiurewicz-dendrite.jpg) Misiurewicz dendrite | ![Scepter](images/target-examples/mandelbrot-scepter.jpg) Scepter |
| ![Deep spiral](images/target-examples/mandelbrot-deep-spiral.jpg) Deep spiral | | |

## Colormaps

The same Spiral arms target rendered in each available colormap:

| | | |
|---|---|---|
| ![Aurora](images/colormap-examples/mandelbrot-spiral-arms-aurora-q340.jpg) Aurora | ![Magma](images/colormap-examples/mandelbrot-spiral-arms-magma-q340.jpg) Magma | ![Inferno](images/colormap-examples/mandelbrot-spiral-arms-inferno-q340.jpg) Inferno |
| ![Plasma](images/colormap-examples/mandelbrot-spiral-arms-plasma-q340.jpg) Plasma | ![Viridis](images/colormap-examples/mandelbrot-spiral-arms-viridis-q340.jpg) Viridis | ![Cividis](images/colormap-examples/mandelbrot-spiral-arms-cividis-q340.jpg) Cividis |
| ![Turbo](images/colormap-examples/mandelbrot-spiral-arms-turbo-q340.jpg) Turbo | ![Rocket](images/colormap-examples/mandelbrot-spiral-arms-rocket-q340.jpg) Rocket | ![Mako](images/colormap-examples/mandelbrot-spiral-arms-mako-q340.jpg) Mako |
| ![Twilight](images/colormap-examples/mandelbrot-spiral-arms-twilight-q340.jpg) Twilight | | |

