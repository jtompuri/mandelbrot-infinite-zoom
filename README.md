# Mandelbrot Infinite Zoom

Browser-based Mandelbrot explorer with progressive rendering, adaptive
anti-aliasing, and drag-to-zoom selection. Renders off the main thread in a
Web Worker; the Python script is just a static file server.

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

## License

[MIT](LICENSE)
