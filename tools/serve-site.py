"""Serve the public build with the same named-page routes as Netlify."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import tomllib

ROOT = Path(__file__).resolve().parent.parent
CONFIG = tomllib.loads((ROOT / "netlify.toml").read_text(encoding="utf-8"))
ROUTES = {rule["from"]: rule["to"] for rule in CONFIG.get("redirects", []) if rule.get("status") == 200}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "dist"), **kwargs)

    def translate_path(self, path):
        pathname = urlsplit(path).path.rstrip("/") or "/"
        return super().translate_path(ROUTES.get(pathname, path))

if __name__ == "__main__":
    print("Atlas Run: http://127.0.0.1:4173", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 4173), Handler).serve_forever()
