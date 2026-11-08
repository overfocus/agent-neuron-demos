#!/usr/bin/env node
// npm run watch <demo> [-- flags]: one command to see a demo. It starts the
// viewer (agent-neuron-viz) if it is not running, starts the stage, opens it
// in the browser, and runs the demo with the invented people answering at a
// watchable pace. Pass --live to answer on the desks yourself, --pace <s> to
// change the pace; every other flag goes to the demo (--ants 40, --tie, ...).
// When the run ends the page stays up for its replay; Ctrl-C stops what this
// command started.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HERE } from '../lib/engine.mjs';
import { openUrl } from '../lib/narrate.mjs';
import { answering, startStage, VIZ_URL } from '../lib/stage.mjs';

const DEMOS = path.join(HERE, 'demos');
const VIZ_DIR = path.resolve(process.env.AGENT_NEURON_VIZ ?? path.join(HERE, '../agent-neuron-viz'));
const say = (l) => console.log(`watch: ${l}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const [name, ...flags] = process.argv.slice(2);
const names = fs.readdirSync(DEMOS).filter((n) => fs.existsSync(path.join(DEMOS, n, 'demo.mjs'))).sort();
if (!name || !names.includes(name)) {
  console.log(`npm run watch <demo> [-- --live] [-- --pace <seconds>]\n\ndemos: ${names.join(', ')}`);
  process.exit(name ? 2 : 0);
}

// 1. The viewer: running already, or started here from the sibling checkout.
let viewer = null;
if (await answering(VIZ_URL)) {
  say(`the viewer is already running at ${VIZ_URL}`);
} else {
  if (!fs.existsSync(path.join(VIZ_DIR, 'package.json'))) {
    say(`no agent-neuron-viz at ${VIZ_DIR}: run npm run setup first (it clones it next to this repo)`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(VIZ_DIR, 'node_modules'))) {
    say('installing the viewer (npm install in agent-neuron-viz, once)...');
    const r = spawn('npm', ['install', '--no-audit', '--no-fund'], { cwd: VIZ_DIR, stdio: 'inherit' });
    if ((await new Promise((res) => r.on('exit', res))) !== 0) process.exit(1);
  }
  say('starting the viewer...');
  fs.mkdirSync(path.join(HERE, 'runs'), { recursive: true });
  const log = fs.openSync(path.join(HERE, 'runs/viewer.log'), 'w');
  viewer = spawn('npm', ['run', 'dev'], {
    cwd: VIZ_DIR,
    env: { ...process.env, PORT: new URL(VIZ_URL).port || '5180', AGENT_NEURON_DEMOS: HERE },
    stdio: ['ignore', log, log],
    detached: true, // its own group, so Ctrl-C here stops vite too
  });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(500);
    up = await answering(VIZ_URL);
  }
  if (!up) {
    say(`the viewer did not come up at ${VIZ_URL}; see runs/viewer.log`);
    stop(1);
  }
  // A fresh dev server compiles the page's modules on their first request:
  // ask for them now, so the page attaches the moment it opens.
  const base = new URL(VIZ_URL).origin;
  await fetch(`${base}/src/main.ts`).catch(() => {});
  await sleep(3000);
}

// 2. The stage, which frames the viewer and every person's desk.
let stage = await startStage();
if (!stage) {
  stage = { url: `http://127.0.0.1:${process.env.STAGE_PORT ?? 5190}/`, close() {} };
  say(`a stage is already running at ${stage.url}`);
} else say(`the stage: ${stage.url}`);
if (!flags.includes('--no-open')) openUrl(stage.url);
await sleep(2500); // let the page load and attach before the run starts

// 3. The demo: the invented people answer, at a pace you can follow.
const live = flags.includes('--live');
if (!live && !flags.includes('--pace')) process.env.DEMO_PACE_MS = '2000';
const pace = flags.indexOf('--pace');
if (pace >= 0) process.env.DEMO_PACE_MS = String(Math.round(Number(flags[pace + 1] ?? 2) * 1000));
if (live) say('--live: answer on the desks in the stage (or open the links below)');
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, () => stop(130));
const mod = await import(pathToFileURL(path.join(DEMOS, name, 'demo.mjs')).href);
const result = await mod.main({ headless: !live, flags });

say(`done. The stage replays the run: drag the timeline in the 3D view. Run another demo here or in another terminal (npm run demo <name>) and the stage follows it.`);
say('Ctrl-C to stop.');
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => stop(result?.code ?? 0));
await new Promise(() => {});

function stop(code) {
  stage?.close();
  if (viewer) {
    try {
      process.kill(-viewer.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  process.exit(code);
}
