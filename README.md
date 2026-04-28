# Mandelbrot Infinite Zoom

![Mandelbrot overview in Aurora colormap](images/colormap-examples/mandelbrot-overview-aurora-q340.jpg)

Browser-based Mandelbrot explorer with progressive rendering, adaptive
anti-aliasing, and drag-to-zoom selection. Rendering runs in a Web Worker;
the Python script is a static file server.

## About the Mandelbrot set

The Mandelbrot set is the set of complex numbers $c$ for which the iteration

$$z_{n+1} = z_n^2 + c, \quad z_0 = 0$$

stays bounded as $n \to \infty$. In practice we cap the iteration at some
maximum and treat any orbit that escapes the disk $|z| > 2$ as outside the
set; the iteration count at the moment of escape gives the colored bands.

The set is named after Benoît Mandelbrot, who studied it in the late 1970s.
Earlier images of the same set were produced by Brooks and Matelski. The
set is a fractal: its boundary has no smooth pieces, contains arbitrarily
fine detail at any scale, and contains self-similar miniature copies of
the whole set at all depths. The boundary has Hausdorff dimension 2 but
zero area, so zooming into the boundary keeps revealing structure.

In rendered images, pixels that escape quickly are colored by their escape
iteration, pixels that never escape are drawn as the interior color, and
the boundary detail sits between the two.

## Features

- Progressive preview + full render pipeline.
- Adaptive anti-aliasing presets: Off, 2x, 3x, 4x.
- **Ultra Fractal-inspired Coloring**: Supports cyclic coloring with adjustable **Color Density** and **Gradient Offset**.
- **Smart Colormaps**: Perceptually uniform maps are automatically mirrored to support smooth cyclic transitions without jumps.
- Drag-to-zoom, click-to-recenter, mouse wheel, and `+` / `−` / `1:1` buttons.
- Keyboard shortcuts: `+` / `−` / `z` / `x` to zoom, `0` to reset zoom.
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

For running tests with `pytest`, set up a virtual environment:

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

- `runProductionBenchmark()`: measures the user-facing render path.
- `runMandelbrotBenchmark()`: adaptive-AA benchmark with per-pixel stats.
- `runMandelbrotBenchmarkWithFull()`: also runs full-supersampling cases for reference.

## Targets

| | | |
|---|---|---|
| ![Seahorse valley](images/target-examples/mandelbrot-seahorse-valley.jpg) Seahorse valley | ![Seahorse](images/target-examples/mandelbrot-seahorse.jpg) Seahorse | ![Seahorse spiral](images/target-examples/mandelbrot-seahorse-spiral.jpg) Seahorse spiral |
| ![Period-2 bulb](images/target-examples/mandelbrot-period-2-bulb.jpg) Period-2 bulb | ![Top bulb](images/target-examples/mandelbrot-top-bulb.jpg) Top bulb | ![Elephant valley](images/target-examples/mandelbrot-elephant-valley.jpg) Elephant valley |
| ![Triple spiral valley](images/target-examples/mandelbrot-triple-spiral-valley.jpg) Triple spiral valley | ![Spiral arms](images/target-examples/mandelbrot-spiral-arms.jpg) Spiral arms | ![Mini Mandelbrot](images/target-examples/mandelbrot-mini-mandelbrot.jpg) Mini Mandelbrot |
| ![Lightning](images/target-examples/mandelbrot-lightning.jpg) Lightning | ![Misiurewicz dendrite](images/target-examples/mandelbrot-misiurewicz-dendrite.jpg) Misiurewicz dendrite | ![Scepter](images/target-examples/mandelbrot-scepter.jpg) Scepter |
| ![Deep spiral](images/target-examples/mandelbrot-deep-spiral.jpg) Deep spiral | | |

## Colormaps

Default colormap is **Early sunset**. All sequential colormaps are automatically mirrored to ensure smooth cyclic transitions when using density and offset.

The same Spiral arms target rendered in each available colormap:

| | | |
|---|---|---|
| ![Early sunset](images/colormap-examples/ultrafractal-colormap.png) Early sunset | ![Aurora](images/colormap-examples/mandelbrot-spiral-arms-aurora-q340.jpg) Aurora | ![Magma](images/colormap-examples/mandelbrot-spiral-arms-magma-q340.jpg) Magma |
| ![Inferno](images/colormap-examples/mandelbrot-spiral-arms-inferno-q340.jpg) Inferno | ![Plasma](images/colormap-examples/mandelbrot-spiral-arms-plasma-q340.jpg) Plasma | ![Viridis](images/colormap-examples/mandelbrot-spiral-arms-viridis-q340.jpg) Viridis |
| ![Cividis](images/colormap-examples/mandelbrot-spiral-arms-cividis-q340.jpg) Cividis | ![Turbo](images/colormap-examples/mandelbrot-spiral-arms-turbo-q340.jpg) Turbo | ![Rocket](images/colormap-examples/mandelbrot-spiral-arms-rocket-q340.jpg) Rocket |
| ![Mako](images/colormap-examples/mandelbrot-spiral-arms-mako-q340.jpg) Mako | ![Twilight](images/colormap-examples/mandelbrot-spiral-arms-twilight-q340.jpg) Twilight | |

