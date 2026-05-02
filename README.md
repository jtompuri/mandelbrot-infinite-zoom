# Mandelbrot Infinite Zoom

![Mandelbrot overview in Clear sky colormap](images/target-examples/mandelbrot-overview-clearsky-q340.jpeg)

**Live Demo:** [https://jtompuri.github.io/mandelbrot-infinite-zoom](https://jtompuri.github.io/mandelbrot-infinite-zoom)

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
- Cyclic coloring with adjustable **Color Density** and **Gradient Offset**.
- Sequential colormaps are mirrored for smooth cyclic transitions.
- Drag-to-zoom, click-to-recenter, mouse wheel, and `+` / `−` / `1:1` buttons.
- Keyboard shortcuts: `+` / `−` / `z` / `x` to zoom, `0` to reset zoom, arrow keys to pan.
- Animated infinite zoom that auto-pans toward boundary detail.
- Multiple colormaps and curated views.
- ARIA-compliant controls, keyboard navigation, and live regions.
- Save the current frame as PNG (filename includes the selected view,
  colormap, and quality).

## Run

```bash
python mandelbrot.py
```

Opens `http://127.0.0.1:8000/` in your browser. Use `--port`, `--host`, or
`--no-browser` to override defaults. Requires Python 3.10+ and a modern
browser; no third-party runtime dependencies.

## Tests

Python tests cover the static server, HTML structure, and worker pipeline
contract:

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

Or with `pytest` (see [requirements-dev.txt](requirements-dev.txt)).

JavaScript unit tests cover the worker's pure math/color functions
(`mandelbrotColor`, `colorAt`, `isProbablyInside`, adaptive AA helpers,
etc.). They run on Node's built-in test runner with no dependencies:

```bash
node --test tests/test_worker.js
```

Requires Node 18 or newer.

## Views

<!-- markdownlint-disable MD060 -->
| | | |
|---|---|---|
| ![Seahorse valley](images/target-examples/mandelbrot-seahorse-valley-clearsky-q340.jpeg) Seahorse valley | ![Seahorse](images/target-examples/mandelbrot-seahorse-clearsky-q340.jpeg) Seahorse | ![Spiral arms](images/target-examples/mandelbrot-spiral-arms-clearsky-q340.jpeg) Spiral arms |
| ![Period-2 bulb](images/target-examples/mandelbrot-period-2-bulb-clearsky-q340.jpeg) Period-2 bulb | ![Top bulb](images/target-examples/mandelbrot-top-bulb-clearsky-q340.jpeg) Top bulb | ![Elephant valley](images/target-examples/mandelbrot-elephant-valley-clearsky-q340.jpeg) Elephant valley |
| ![Triple spiral valley](images/target-examples/mandelbrot-triple-spiral-valley-clearsky-q340.jpeg) Triple spiral valley | ![Mini Mandelbrot](images/target-examples/mandelbrot-mini-mandelbrot-clearsky-q340.jpeg) Mini Mandelbrot | ![Lightning](images/target-examples/mandelbrot-lightning-clearsky-q340.jpeg) Lightning |
| ![Misiurewicz dendrite](images/target-examples/mandelbrot-misiurewicz-dendrite-clearsky-q340.jpeg) Misiurewicz dendrite | ![Scepter](images/target-examples/mandelbrot-scepter-clearsky-q340.jpeg) Scepter | ![Deep spiral](images/target-examples/mandelbrot-deep-spiral-clearsky-q340.jpeg) Deep spiral |
<!-- markdownlint-enable MD060 -->

## Colormaps

Default colormap is **Clear sky**. Sequential colormaps are mirrored for smooth cyclic transitions.

The same Period-2 bulb view rendered in each available colormap:

<!-- markdownlint-disable MD060 -->
| | | |
|---|---|---|
| ![Clear sky](images/colormap-examples/mandelbrot-period-2-bulb-clearsky-q340.jpeg) Clear sky | ![Aurora](images/colormap-examples/mandelbrot-period-2-bulb-aurora-q340.jpeg) Aurora | ![Magma](images/colormap-examples/mandelbrot-period-2-bulb-magma-q340.jpeg) Magma |
| ![Inferno](images/colormap-examples/mandelbrot-period-2-bulb-inferno-q340.jpeg) Inferno | ![Plasma](images/colormap-examples/mandelbrot-period-2-bulb-plasma-q340.jpeg) Plasma | ![Viridis](images/colormap-examples/mandelbrot-period-2-bulb-viridis-q340.jpeg) Viridis |
| ![Cividis](images/colormap-examples/mandelbrot-period-2-bulb-cividis-q340.jpeg) Cividis | ![Turbo](images/colormap-examples/mandelbrot-period-2-bulb-turbo-q340.jpeg) Turbo | ![Rocket](images/colormap-examples/mandelbrot-period-2-bulb-rocket-q340.jpeg) Rocket |
| ![Mako](images/colormap-examples/mandelbrot-period-2-bulb-mako-q340.jpeg) Mako | ![Twilight](images/colormap-examples/mandelbrot-period-2-bulb-twilight-q340.jpeg) Twilight | |
<!-- markdownlint-enable MD060 -->
