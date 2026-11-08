// Where the engine is: the agent-neuron checkout next to this repo (or
// AGENT_NEURON_ROOT), and its Rust binary (or NEURON_ENGINE). The demos only
// ever run the engine's command line; nothing here imports agent-neuron code.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const AGENT_NEURON = path.resolve(process.env.AGENT_NEURON_ROOT ?? path.join(HERE, '../agent-neuron'));
export const ENGINE = path.resolve(process.env.NEURON_ENGINE ?? path.join(AGENT_NEURON, 'rust-engine/target/debug/neuron-engine'));
export const RUNS = path.join(HERE, 'runs');

/** The engine binary, built when it is missing (cargo, in the checkout). */
export function ensureEngine(say = console.log) {
  if (fs.existsSync(ENGINE)) return ENGINE;
  if (process.env.NEURON_ENGINE) throw new Error(`NEURON_ENGINE names ${ENGINE}, which does not exist`);
  if (!fs.existsSync(path.join(AGENT_NEURON, 'rust-engine/Cargo.toml'))) {
    throw new Error(`no agent-neuron checkout at ${AGENT_NEURON}: clone it next to this repo, or set AGENT_NEURON_ROOT`);
  }
  say('building the engine (cargo build in agent-neuron/rust-engine)...');
  const r = spawnSync('cargo', ['build', '--manifest-path', path.join(AGENT_NEURON, 'rust-engine/Cargo.toml')], { stdio: 'inherit' });
  if (r.status !== 0 || !fs.existsSync(ENGINE)) throw new Error('cargo build failed');
  return ENGINE;
}

/** A demo's own run folder under runs/, emptied. */
export function runDir(name) {
  const dir = path.join(RUNS, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
