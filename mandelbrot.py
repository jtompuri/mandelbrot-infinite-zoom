from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import mimetypes
import socket
import webbrowser


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
INDEX_PATH = STATIC_DIR / "index.html"


def is_index_path(path):
    return path in ("/", "/index.html")


def static_path_for_request(path):
    if is_index_path(path):
        return INDEX_PATH

    clean_path = path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
    candidate = (STATIC_DIR / clean_path).resolve()
    try:
        candidate.relative_to(STATIC_DIR.resolve())
    except ValueError:
        return None
    return candidate


def read_static_file(path):
    static_path = static_path_for_request(path)
    if not static_path or not static_path.is_file():
        return None, None

    content_type = mimetypes.guess_type(static_path.name)[0] or "application/octet-stream"
    if static_path.suffix == ".js":
        content_type = "text/javascript"
    elif static_path.suffix == ".css":
        content_type = "text/css"
    elif static_path.suffix == ".html":
        content_type = "text/html; charset=utf-8"

    return static_path.read_bytes(), content_type


def index_response_body():
    body, _ = read_static_file("/")
    if body is None:
        raise FileNotFoundError(INDEX_PATH)
    return body


class MandelbrotHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body, content_type = read_static_file(self.path)
        if body is None or content_type is None:
            self.send_error(404)
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def find_free_port(preferred):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        if probe.connect_ex(("127.0.0.1", preferred)) != 0:
            return preferred

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description="Run a local Mandelbrot infinite zoom app.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    port = find_free_port(args.port) if args.host in ("127.0.0.1", "localhost") else args.port
    server = ThreadingHTTPServer((args.host, port), MandelbrotHandler)
    url = f"http://{args.host}:{port}/"

    print(f"Mandelbrot app running at {url}")
    print("Press Ctrl+C to stop.")

    if not args.no_browser:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
