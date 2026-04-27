# Mandelbrot Infinite Zoom

Browser-based Mandelbrot explorer with progressive rendering, adaptive
anti-aliasing, and drag-to-zoom selection. Renders off the main thread in a
Web Worker; the Python script is just a static file server.

## Features

- Progressive preview + full render pipeline.
- Adaptive anti-aliasing presets: Off, 2x, 3x, 4x.
- Drag-to-zoom, click-to-recenter, and mouse wheel zoom.
- Animated infinite zoom with adjustable speed.
- Multiple colormaps and curated targets.
- Save the current frame as PNG.

## Run

```bash
python mandelbrot.py
```

Opens `http://127.0.0.1:8000/` in your browser. Use `--port`, `--host`, or
`--no-browser` to override defaults. Requires Python 3.10+ and a modern
browser; no third-party dependencies.

## Tests

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

## Benchmarking

From the browser DevTools console while the app is open:

- `runProductionBenchmark()` — measures the user-facing render path.
- `runMandelbrotBenchmark()` — detailed adaptive-AA benchmark with stats.
- `runMandelbrotBenchmarkWithFull()` — adds full-supersampling reference cases.

## License

[MIT](LICENSE)
