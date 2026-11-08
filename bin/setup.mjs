#!/usr/bin/env node
// npm run setup: everything the demos need, next to this repo. Clones
// agent-neuron (the engine) and agent-neuron-viz (the 3D view) beside this
// checkout when they are missing, installs the viewer, and builds the engine
// (cargo). Safe to run again: it skips what is there.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AGENT_NEURON, ENGINE, HERE, ensureEngine } from '../lib/engine.mjs';

const VIZ = path.resolve(process.env.AGENT_NEURON_VIZ ?? path.join(HERE, '../agent-neuron-viz'));
const say = (l) => console.log(`setup: ${l}`);
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) {
    say(`${cmd} ${args.join(' ')} failed`);
    process.exit(1);
  }
};

if (Number(process.versions.node.split('.')[0]) < 22) {
  say(`Node 22 or newer is needed (this is ${process.versions.node})`);
  process.exit(1);
}
for (const [dir, repo] of [
  [AGENT_NEURON, 'https://github.com/overfocus/agent-neuron'],
  [VIZ, 'https://github.com/overfocus/agent-neuron-viz'],
]) {
  if (fs.existsSync(dir)) say(`${path.basename(dir)} is there`);
  else {
    say(`cloning ${repo} into ${dir}`);
    run('git', ['clone', '--depth', '1', repo, dir], path.dirname(dir));
  }
}
if (!fs.existsSync(path.join(VIZ, 'node_modules'))) {
  say('installing the viewer');
  run('npm', ['install', '--no-audit', '--no-fund'], VIZ);
}
if (!fs.existsSync(ENGINE)) {
  if (spawnSync('cargo', ['--version']).status !== 0) {
    say('the engine is built with Rust: install it from https://rustup.rs, then run npm run setup again');
    process.exit(1);
  }
  ensureEngine((l) => say(l));
}
say('ready. Try: npm run watch colony   (or quorum, backlog, spend, refunds, oncall)');
