# The videos

Two demo videos rendered by the same pipeline — a composition for each demo,
one renderer and one sound mixer shared.

1. **Scenes** — `composition.html` (the colony) and `composition-backlog.html`
   (the backlog board). Each scene is a function of time: give it a moment and
   it draws exactly what the screen shows then, so every frame comes out the
   same each render. Data is the frozen record of one real run (`data.js`,
   `data-backlog.js`), never a live page.
2. **Frames** — `render.py`. Playwright opens the composition in headless
   Chrome, steps through time at 60 fps and screenshots each frame into
   `frames/` (about 2,800 PNGs for the ~46 s cut). It first exports the sound
   cues the scenes declare to `sound-events.json`.
3. **Sound** — `sound.py`. Every effect is synthesized with numpy — sine waves,
   filtered noise, envelopes. No samples, no stock audio. The music bed is
   Kevin's track, decoded with ffmpeg and normalized; cues land on the picture
   because the composition itself computed their times.
4. **Video** — `render.py --mux`. ffmpeg combines the frames and the soundtrack
   into `out/<demo>.mp4`, 1920x1080 at 60 fps.

## Render the colony

```sh
cd video
python3 -m venv .venv && ./.venv/bin/pip install numpy playwright && ./.venv/bin/playwright install chromium

node build-data.mjs ../runs/colony          # one recorded run -> data.js
./.venv/bin/python render.py
./.venv/bin/python sound.py
./.venv/bin/python render.py --mux                      # out/colony.mp4
```

## Render the backlog

```sh
node build-data-backlog.mjs ../runs/backlog              # data-backlog.js from a fresh run
./.venv/bin/python render.py --html composition-backlog.html --data data-backlog.js
./.venv/bin/python sound.py
./.venv/bin/python render.py --html composition-backlog.html --data data-backlog.js --mux --out out/backlog.mp4
```

## Render the companies

```sh
node build-data-companies.mjs ../runs/companies              # data-companies.js from a fresh run
./.venv/bin/python render.py --html composition-companies.html --data data-companies.js --frames frames-companies
./.venv/bin/python sound.py
./.venv/bin/python render.py --html composition-companies.html --data data-companies.js --frames frames-companies --skip-frames --mux --out out/companies.mp4
```

The companies' compiler reads the run's own records too — both takes
(`wire/` and `house/` streams, the `desk answer:` lines, the journal and the
actions logs, each partner's own stderr log for the port it really bound) and
the tracked network files beside the repo for the topology. It re-stamps one
merged timeline: the second arrival's chain shifts as a group to after the
first arrival's clearance (they really overlapped), the in-house take is
re-based after take 1 ends, and the wrapper's inner stations are interpolated
around their composed answer — the driver hears only the marks, and the
composition says so on screen.

The backlog's compiler reads the run's own records: the stream (rules verdicts,
landed/scheduled/record answers, the budget refusal), `landed.jsonl`, and the
desk's `desk answer:` lines for the ledger — who decided, what, and each
person's own why. Its network is a tracked file, so it is read beside the repo.

The run a video plays is whatever `runs/<demo>/` held when the data was
compiled — data.js is committed, so every take renders identically forever.
For a fresh colony take: `npm run demo colony -- --ants 40 --seconds 60 --seed
11`, then recompile. A smoke render with synthetic data:
`node build-data.mjs --stub --out data.stub.js && ./.venv/bin/python render.py
--data data.stub.js --seconds 3`.

Everything rendered is true of the run: the captions quote each compiler's
`facts` (the dry moment, wasted trips, the drops, trips per eager third, the
settle second — or the backlog's flag, refusal, sent-back and record), which
`build-data*.mjs` read off the same files the engine wrote.
