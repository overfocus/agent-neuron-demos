"""Probe frames of the real companies composition before the full render.

  ./.venv/bin/python probe-companies.py <t> [<t> ...]

Renders single frames at the given video seconds into frames-companies/ and
opens nothing: the frames are the check.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
FRAMES = HERE / "frames-companies"

times = [float(a) for a in sys.argv[1:]] or [1.0, 5.0, 7.2, 10.2, 16.2, 20.0, 22.5, 26.5, 28.4, 31.6, 34.0, 37.5, 40.2, 44.6, 45.8]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page.goto((HERE / "composition-companies.html").as_uri() + "?data=data-companies.js")
    page.wait_for_function("window.READY === true", timeout=30000)
    FRAMES.mkdir(parents=True, exist_ok=True)
    for t in times:
        i = int(round(t * 60))
        page.evaluate(f"renderFrame({t!r})")
        path = FRAMES / f"probe-{i:05d}.png"
        page.screenshot(path=str(path), type="png")
        print(f"{t:>5.1f}s -> {path.name}")
    browser.close()
