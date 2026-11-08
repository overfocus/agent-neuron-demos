# The colony video

The colony, rendered: scenes as functions of time, frames through headless
Chrome, sound synthesized from math, ffmpeg to the MP4.

1. **Scenes** — `composition.html`. Each scene is a function of time: give it a
   moment and it draws exactly what the screen shows then, so every frame comes
   out the same each render. Data is the frozen record of one real run
   (`data.js`), never a live page.
2. **Frames** — `render.py`. Playwright opens the page in headless Chrome,
   steps through time at 60 fps and screenshots each frame into `frames/`
   (about 2,800 PNGs for the ~46 s cut). It first exports the sound cues the
   scenes declare to `sound-events.json`.
3. **Sound** — `sound.py`. Every effect is synthesized with numpy — sine waves,
   filtered noise, envelopes. No samples, no stock audio. Cues land on the
   picture because the composition itself computed their times.
4. **Video** — `render.py --mux`. ffmpeg combines the frames and the soundtrack
   into `out/colony.mp4`, 1920x1080 at 60 fps.

## Render it

```sh
cd video
python3 -m venv .venv && ./.venv/bin/pip install numpy playwright && ./.venv/bin/playwright install chromium

node build-data.mjs ../runs/colony          # one recorded run -> data.js
./.venv/bin/python render.py                # frames/ + sound-events.json
./.venv/bin/python sound.py                 # soundtrack.wav
./.venv/bin/python render.py --mux          # out/colony.mp4
```

The run the video plays is whatever `runs/colony/` holds — the same take every
render. For a fresh take: `npm run demo colony -- --ants 40 --seconds 60 --seed
11`, then `node build-data.mjs ../runs/colony` again. A smoke render with
synthetic data: `node build-data.mjs --stub --out data.stub.js &&
./.venv/bin/python render.py --data data.stub.js --seconds 3`.

Everything rendered is true of the run: the captions quote `data.js`'s `facts`
(the dry moment, wasted trips, the drops, trips per eager third, the settle
second), which `build-data.mjs` reads off the same files the engine wrote.
