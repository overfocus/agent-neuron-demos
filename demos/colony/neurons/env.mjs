// The colony's environment (stigmergy): one JSON file beside the run. Only
// the nest writes it (atomic rename); ants read it. Nothing else is shared.
import fs from 'node:fs';
import path from 'node:path';

const FILE = () => path.join(process.env.COLONY_DIR, 'env.json');

export function readEnv() {
  try {
    return JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    return { hunger: 0, pheromone: {}, tick: 0 };
  }
}

export function writeEnv(env) {
  const tmp = `${FILE()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(env));
  fs.renameSync(tmp, FILE());
}
