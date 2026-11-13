#!/usr/bin/env node
// npm run doctor: is everything a demo needs in place? Checks Node, the
// agent-neuron checkout, the engine binary (built if missing and cargo is
// there), and the optional viewer. Prints what to do about anything missing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AGENT_NEURON, ENGINE, HERE, engineCommit, ensureEngine, pinnedCommit } from '../lib/engine.mjs';

let bad = 0;
const ok = (what) => console.log(`  ok    ${what}`);
const no = (what, fix) => {
  bad++;
  console.log(`  MISSING ${what}\n          ${fix}`);
};
const opt = (what, fix) => console.log(`  --    ${what}\n          ${fix}`);

console.log('agent-neuron-demos: checking what the demos need\n');
const major = Number(process.versions.node.split('.')[0]);
if (major >= 22) ok(`Node ${process.versions.node}`);
else no(`Node 22 or newer (this is ${process.versions.node})`, 'install Node 22: https://nodejs.org');

if (fs.existsSync(path.join(AGENT_NEURON, 'rust-engine/Cargo.toml'))) ok(`agent-neuron at ${AGENT_NEURON}`);
else no(`agent-neuron at ${AGENT_NEURON}`, `git clone https://github.com/overfocus/agent-neuron ${path.relative(process.cwd(), AGENT_NEURON) || AGENT_NEURON}  (or set AGENT_NEURON_ROOT)`);

if (fs.existsSync(ENGINE)) ok(`the engine, ${path.relative(HERE, ENGINE)}`);
else if (!bad && spawnSync('cargo', ['--version']).status === 0) {
  try {
    ensureEngine((l) => console.log(`        ${l}`));
    ok('the engine, built just now');
  } catch (e) {
    no('the engine', `cargo build failed: ${e.message}`);
  }
} else no('the engine', 'install Rust (https://rustup.rs), then run npm run doctor again: it builds the engine');

// Which engine this is, beside the one the tests last passed on. Information only.
if (fs.existsSync(ENGINE)) {
  const have = engineCommit();
  const pinned = pinnedCommit();
  const short = (c) => (c ? c.slice(0, 7) + (c.endsWith('-dirty') ? '-dirty' : '') : 'unknown');
  if (have && pinned && have === pinned) ok(`engine commit ${short(have)}, the one the tests last passed on`);
  else if (pinned) opt(`engine commit ${short(have)}; the tests last passed on ${short(pinned)}`, 'fine if npm test passes; npm run pin records it');
}

const viz = path.resolve(process.env.AGENT_NEURON_VIZ ?? path.join(HERE, '../agent-neuron-viz'));
if (!fs.existsSync(path.join(viz, 'package.json'))) {
  opt('agent-neuron-viz (optional: the 3D view)', `git clone https://github.com/overfocus/agent-neuron-viz ${path.relative(process.cwd(), viz)}`);
} else if (!fs.existsSync(path.join(viz, 'node_modules'))) {
  opt(`agent-neuron-viz at ${viz}, not installed yet`, `(cd ${path.relative(process.cwd(), viz)} && npm install)`);
} else {
  const up = await fetch('http://localhost:5180/').then((r) => r.ok).catch(() => false);
  ok(`agent-neuron-viz at ${viz}${up ? ', running on :5180' : ''}`);
  if (!up) opt('the viewer is not running', `(cd ${path.relative(process.cwd(), viz)} && npm run dev), then open http://localhost:5180/?attach`);
}

console.log('');
if (bad) {
  console.log(`${bad} thing${bad > 1 ? 's' : ''} to fix first.`);
  process.exit(1);
}
console.log('Ready. Try:  npm run demo quorum -- --headless');
console.log('Then:       npm run demo quorum          (and answer on the three desk pages yourself)');
