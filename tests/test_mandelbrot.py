from html.parser import HTMLParser
import re
import unittest

import mandelbrot


def read_static(name):
    return (mandelbrot.STATIC_DIR / name).read_text(encoding="utf-8")


class SelectParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current_select = None
        self.current_option = None
        self.selects = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "select":
            self.current_select = attrs.get("id")
            if self.current_select:
                self.selects.setdefault(self.current_select, [])
        elif tag == "option" and self.current_select:
            self.current_option = {"value": attrs.get("value", ""), "text": ""}

    def handle_data(self, data):
        if self.current_option is not None:
            self.current_option["text"] += data

    def handle_endtag(self, tag):
        if tag == "option" and self.current_select and self.current_option:
            self.current_option["text"] = self.current_option["text"].strip()
            self.selects[self.current_select].append(self.current_option)
            self.current_option = None
        elif tag == "select":
            self.current_select = None


def parse_selects():
    parser = SelectParser()
    parser.feed(read_static("index.html"))
    return parser.selects


class MandelbrotAppTests(unittest.TestCase):
    def test_index_paths_are_accepted(self):
        self.assertTrue(mandelbrot.is_index_path("/"))
        self.assertTrue(mandelbrot.is_index_path("/index.html"))
        self.assertFalse(mandelbrot.is_index_path("/favicon.ico"))
        self.assertFalse(mandelbrot.is_index_path("/app.js"))

    def test_static_files_are_served_with_content_types(self):
        for path, expected_content_type in (
            ("/", "text/html; charset=utf-8"),
            ("/index.html", "text/html; charset=utf-8"),
            ("/app.js", "text/javascript"),
            ("/worker.js", "text/javascript"),
            ("/styles.css", "text/css"),
        ):
            body, content_type = mandelbrot.read_static_file(path)
            self.assertIsNotNone(body, path)
            self.assertEqual(content_type, expected_content_type)

    def test_static_paths_cannot_escape_static_directory(self):
        body, content_type = mandelbrot.read_static_file("/../mandelbrot.py")

        self.assertIsNone(body)
        self.assertIsNone(content_type)

    def test_index_response_is_html_bytes(self):
        body = mandelbrot.index_response_body()

        self.assertIsInstance(body, bytes)
        self.assertIn(b"<!doctype html>", body)
        self.assertIn(b'<canvas id="fractal"></canvas>', body)
        self.assertIn(b'<script src="/app.js" defer></script>', body)

    def test_ui_exposes_expected_controls(self):
        html = read_static("index.html")

        for control_id in (
            "toggle",
            "collapse",
            "reset",
            "save",
            "target",
            "colormap",
            "antialias",
            "quality",
            "speed",
        ):
            self.assertIn(f'id="{control_id}"', html)

        self.assertIn('id="selection"', html)
        self.assertNotIn('id="render"', html)
        self.assertNotIn('id="animation-antialias"', html)

    def test_beautiful_targets_are_available(self):
        html = read_static("index.html")

        for target in (
            "Seahorse valley",
            "Seahorse webs",
            "Elephant valley",
            "Triple spiral valley",
            "Quad spiral valley",
            "Scepter valley",
            "Double scepter valley",
            "Scepter medallion",
            "Triple spiral medallion",
        ):
            self.assertIn(target, html)

    def test_target_values_are_numeric_coordinate_triples(self):
        target_options = parse_selects()["target"]

        self.assertGreaterEqual(len(target_options), 12)
        for option in target_options:
            parts = option["value"].split(",")
            self.assertEqual(len(parts), 3, option)
            x, y, scale = [float(part) for part in parts]
            self.assertGreater(scale, 0, option)
            self.assertGreaterEqual(x, -2.1, option)
            self.assertLessEqual(x, 0.6, option)
            self.assertGreaterEqual(y, -1.3, option)
            self.assertLessEqual(y, 1.3, option)

    def test_colormap_select_matches_worker_color_maps(self):
        selected_colormaps = {
            option["value"]
            for option in parse_selects()["colormap"]
        }
        defined_colormaps = set(re.findall(r"^\s{2}([a-z]+): \[", read_static("worker.js"), re.MULTILINE))

        self.assertEqual(selected_colormaps, defined_colormaps)

    def test_antialias_values_are_supported_sample_counts(self):
        antialias_options = parse_selects()["antialias"]

        self.assertEqual(
            [(option["value"], option["text"]) for option in antialias_options],
            [("1", "Off"), ("2", "2x"), ("3", "3x"), ("4", "4x")],
        )

    def test_select_options_have_dark_theme_colors(self):
        css = read_static("styles.css")

        self.assertIn("option {", css)
        self.assertIn("background: #101827;", css)
        self.assertIn("color: var(--text);", css)

    def test_drag_selection_zoom_is_available(self):
        app = read_static("app.js")
        css = read_static("styles.css")

        self.assertIn(".selection {", css)
        self.assertIn("function zoomToSelection()", app)
        self.assertIn('canvas.addEventListener("pointerdown"', app)
        self.assertIn('canvas.addEventListener("pointermove"', app)
        self.assertIn('canvas.addEventListener("pointerup"', app)
        self.assertIn("scale *= Math.max(horizontalScale, verticalScale);", app)

    def test_render_status_shows_progress_while_rendering(self):
        app = read_static("app.js")

        self.assertIn("${statusPrefix} preview", app)
        self.assertIn('message.type === "progress"', app)
        self.assertNotIn("renderButton", app)

    def test_final_status_uses_short_center_with_exact_tooltip(self):
        app = read_static("app.js")

        self.assertIn("function updateFinalStatus(maxIter, samples)", app)
        self.assertIn("centerX.toPrecision(6)", app)
        self.assertIn("centerY.toPrecision(6)", app)
        self.assertIn("meter.title = `Exact center:", app)
        self.assertNotIn("centerX.toFixed(12)", app)

    def test_toolbar_can_be_collapsed(self):
        html = read_static("index.html")
        css = read_static("styles.css")
        app = read_static("app.js")

        self.assertIn('id="collapse"', html)
        self.assertIn(".toolbar.collapsed", css)
        self.assertIn('toolbar.classList.toggle("collapsed")', app)
        self.assertIn('collapsed ? "+" : "-"', app)

    def test_worker_render_pipeline_is_progressive_and_off_main_thread(self):
        app = read_static("app.js")
        worker = read_static("worker.js")

        self.assertIn('const worker = new Worker("/worker.js");', app)
        self.assertIn('phase: "preview"', app)
        self.assertIn('phase: "full"', app)
        self.assertIn("previewScale: 4", app)
        self.assertIn('type: "progress"', worker)
        self.assertIn("scheduleYield(step);", worker)

    def test_preview_does_not_replace_existing_full_frame(self):
        app = read_static("app.js")

        self.assertIn("let hasFullFrame = false;", app)
        self.assertIn("if (!hasFullFrame) {", app)
        self.assertIn('message.phase === "preview" && hasFullFrame', app)
        self.assertIn("hasFullFrame = true;", app)

    def test_render_uses_offscreen_buffer_swap(self):
        app = read_static("app.js")

        self.assertIn('const backBuffer = document.createElement("canvas");', app)
        self.assertIn("backCtx.putImageData(image, 0, 0);", app)
        self.assertIn("ctx.drawImage(backBuffer, 0, 0, canvas.width, canvas.height);", app)
        self.assertNotIn("ctx.putImageData(image, 0, 0);", app)

    def test_worker_has_calculation_optimizations(self):
        worker = read_static("worker.js")

        self.assertIn("const LUT_SIZE = 2048;", worker)
        self.assertIn("function paletteLut(name)", worker)
        self.assertIn("function isProbablyInside(cx, cy)", worker)
        self.assertIn("q * (q + shiftedX) <= 0.25 * cy * cy", worker)
        self.assertIn("bulbX * bulbX + cy * cy <= 0.0625", worker)
        self.assertIn("function sampleInto(", worker)
        self.assertIn("function colorDistance(", worker)
        self.assertIn("const FLAT_CONTRAST = 24;", worker)
        self.assertIn("const EDGE_CONTRAST = 72;", worker)
        self.assertIn("function mandelbrotColor(", worker)
        self.assertIn("function writePacked(", worker)
        self.assertIn("colorDistance(centerColor, rightColor)", worker)
        self.assertIn("if (contrast < FLAT_CONTRAST)", worker)
        self.assertIn("if (contrast < EDGE_CONTRAST)", worker)
        self.assertNotIn("new Uint8ClampedArray(20)", worker)
        self.assertIn("activeToken", worker)

    def test_worker_reports_performance_stats(self):
        worker = read_static("worker.js")

        for stat in (
            "pixels",
            "mandelbrotCalls",
            "totalIterations",
            "interiorSkipped",
            "aaFlatSkipped",
            "aaEdgeRejected",
            "aaFullSampled",
        ):
            self.assertIn(stat, worker)

        self.assertIn("function createStats()", worker)
        self.assertIn("stats: job.stats", worker)
        self.assertIn('aaMode: job.aaMode', worker)
        self.assertIn("started: performance.now()", worker)
        self.assertIn("elapsed: performance.now() - job.started", worker)

    def test_app_exposes_console_benchmark_runner(self):
        app = read_static("app.js")

        self.assertIn("function benchmarkCase(samples, aaMode)", app)
        self.assertIn("async function runMandelbrotBenchmark(options = {})", app)
        self.assertIn("window.runMandelbrotBenchmark = runMandelbrotBenchmark;", app)
        self.assertIn("window.runMandelbrotBenchmarkWithFull", app)
        self.assertIn("console.table(results);", app)
        self.assertIn('[2, "adaptive"]', app)
        self.assertIn("const includeFull = Boolean(options.includeFull);", app)
        self.assertIn("if (includeFull)", app)
        self.assertIn('[2, "full"]', app)

    def test_animation_uses_same_antialias_value_as_still_rendering(self):
        app = read_static("app.js")

        self.assertIn("const samples = Number(antialiasSelect.value);", app)
        self.assertNotIn("selectedSamples", app)
        self.assertNotIn("animationAntialias", app)
        self.assertIn("} else {\n    render();\n  }", app)

    def test_normal_render_uses_adaptive_aa_for_all_supersampling_levels(self):
        app = read_static("app.js")

        self.assertIn('const aaMode = "adaptive";', app)
        self.assertNotIn('samples === 2 ? "full" : "adaptive"', app)
        self.assertIn("aaMode,", app)

    def test_speed_slider_increases_zoom_speed_to_the_right(self):
        html = read_static("index.html")
        app = read_static("app.js")
        slider = re.search(r'<input id="speed"[^>]+>', html)

        self.assertIsNotNone(slider)
        self.assertIn('min="1"', slider.group(0))
        self.assertIn('max="100"', slider.group(0))
        self.assertIn("0.985 - speed * 0.205", app)


if __name__ == "__main__":
    unittest.main()
