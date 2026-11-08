// The colony's env.json: hunger, what each food last said it had (lefts),
// and the instant of a trail's first emptied arrival (dead). The pheromone is
// NOT in here any more: the trails are the engine's keep now - the network
// file's ground block (agent-neuron decision 0012) has the nest lay on places
// and the engine both evaporate and route by them. Time acts on this file by
// itself: between writes the colony gets hungrier (GROWTH per STEP_MS), so
// whoever reads it sees the ground as it is now.
import fs from 'node:fs';
import path from 'node:path';

export const STEP_MS = 250;
export const GROWTH = 0.5;
const FILE = () => path.join(process.env.COLONY_DIR, 'env.json');

/** The ground at `now`: the last write, with the hunger grown since. */
export function readEnv(now = Date.now()) {
  let env;
  try {
    env = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    return { hunger: 6, lefts: {}, dead: {}, at: now };
  }
  const steps = Math.max(0, (now - env.at) / STEP_MS);
  return { ...env, hunger: Math.min(20, env.hunger + GROWTH * steps), at: now };
}

export function writeEnv(env) {
  const tmp = `${FILE()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(env));
  fs.renameSync(tmp, FILE());
}
