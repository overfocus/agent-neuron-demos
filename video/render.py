#!/usr/bin/env python3
"""Render the colony video: composition.html, stepped through time.

Scenes live in composition.html as functions of time; every frame is the same
each render. Frames land in frames/ as PNGs; the sound cues the page wants are
exported first to sound-events.json (sound.py synthesizes them); ffmpeg muxes.

  ./.venv/bin/python render.py                      # 60 fps, frames/ + sound-events.json
  ./.venv/bin/python render.py --mux                # + out/colony.mp4 (needs soundtrack.wav; run sound.py first)
  ./.venv/bin/python render.py --data data.stub.js --seconds 3   # a smoke render
"""
import argparse
import json
import pathlib
import subprocess
import sys

from playwright.sync_api import sync_playwright


def main() -> int:
    ap = argparse.ArgumentParser(description="Render the colony video: composition.html, stepped through time.")
    here = pathlib.Path(__file__).parent
    ap.add_argument("--data", default="data.js", help="the frozen dataset, beside composition.html")
    ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--seconds", type=float, default=None, help="override the composition's length")
    ap.add_argument("--frames", default=here / "frames", help="PNG output directory")
    ap.add_argument("--start", type=float, default=0.0, help="first frame's time in seconds")
    ap.add_argument("--skip-frames", action="store_true", help="export sound cues only")
    ap.add_argument("--mux", action="store_true", help="also encode out/colony.mp4 with ffmpeg")
    ap.add_argument("--out", default=here / "out" / "colony.mp4")
    args = ap.parse_args()

    frames = pathlib.Path(args.frames)
    events_path = here / "sound-events.json"
    url = (here / "composition.html").as_uri() + f"?data={pathlib.Path(args.data).name}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page.goto(url)
        page.wait_for_function("window.READY === true", timeout=30000)
        seconds = args.seconds if args.seconds is not None else page.evaluate("window.VIDEO_SECONDS")
        total = int(round(seconds * args.fps))

        events = page.evaluate("JSON.stringify(window.soundEvents())")
        events_path.write_text(events)
        print(f"sound cues: {json.loads(events).__len__()} events -> {events_path.name}")

        if not args.skip_frames:
            frames.mkdir(parents=True, exist_ok=True)
            i0 = int(round(args.start * args.fps))
            for i in range(i0, total):
                page.evaluate(f"renderFrame({i / args.fps!r})")
                page.screenshot(path=str(frames / f"{i:05d}.png"), type="png")
            print(f"frames: {total - i0} PNGs ({total} total) -> {frames}/")
        browser.close()

    if args.mux:
        out = pathlib.Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            "ffmpeg", "-y", "-framerate", str(args.fps),
            "-i", str(frames / "%05d.png"),
            "-i", str(here / "soundtrack.wav"),
            "-c:v", "libx264", "-crf", "18", "-preset", "medium",
            "-pix_fmt", "yuv420p", "-r", str(args.fps), "-s", "1920x1080",
            "-c:a", "aac", "-b:a", "192k", "-shortest", str(out),
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"video: {out} ({out.stat().st_size // 1024} KiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
