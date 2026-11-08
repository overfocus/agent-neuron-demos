// The colony's environment (stigmergy): one JSON file beside the run. Only
// the nest writes it (atomic rename); ants read it. Nothing else is shared.
// Time acts on the ground by itself: between writes, every trail evaporates
// (times RHO per STEP_MS) and the colony gets hungrier (GROWTH per STEP_MS),
// so whoever reads it sees the ground as it is now. Two maps ride beside the
// trails: lefts, what each food last said it had (keyed by food), and dead,
// the instant of the first arrival that found a patch empty - a trail marked
// dead on the ground, which pick() then weighs 0.
import fs from 'node:fs';
import path from 'node:path';

export const STEP_MS = 250;
export const RHO = 0.94;
export const GROWTH = 0.5;
const FILE = () => path.join(process.env.COLONY_DIR, 'env.json');

/** The ground at `now`: the last write, aged by the time since. */
export function readEnv(now = Date.now()) {
  let env;
  try {
    env = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    return { hunger: 6, pheromone: {}, delivered: {}, dead: {}, lefts: {}, at: now };
  }
  const steps = Math.max(0, (now - env.at) / STEP_MS);
  const decay = RHO ** steps;
  const pheromone = Object.fromEntries(Object.entries(env.pheromone).map(([f, p]) => [f, p * decay]));
  return { ...env, pheromone, hunger: Math.min(20, env.hunger + GROWTH * steps), at: now };
}

export function writeEnv(env) {
  const tmp = `${FILE()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(env));
  fs.renameSync(tmp, FILE());
}
