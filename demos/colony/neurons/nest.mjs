// The nest: the only writer of the ground. A delivery feeds the colony and
// lays pheromone on the trail it came from, more for a shorter trip (ants lay
// more for a better source, so a closer trail can overtake a farther one).
// An arrival that found the patch empty carries emptied: it feeds nothing, and
// the nest marks the trail dead (the ground's dead map: the instant of the
// first arrival that found nothing) and logs it with that flag. What each
// food last said it had is kept in lefts. Evaporation and hunger are time
// acting on the ground (env.mjs). The nest never answers: what it changes is
// the ground the ants read.
import fs from 'node:fs';
import path from 'node:path';
import { readEnv, writeEnv } from './env.mjs';
import { serve } from './serve.mjs';

const DEPOSIT_MS = 600; // pheromone per delivery: DEPOSIT_MS / the trip's ms
const log = path.join(process.env.COLONY_DIR, 'deliveries.jsonl');
writeEnv(readEnv());

serve((p) => {
  if (!p?.food) return undefined;
  const env = readEnv();
  env.dead ??= {};
  env.lefts ??= {};
  if (p.emptied) env.dead[p.food] ??= Date.now();
  else {
    env.pheromone[p.food] = (env.pheromone[p.food] ?? 0) + DEPOSIT_MS / (p.trip || DEPOSIT_MS);
    env.delivered[p.food] = (env.delivered[p.food] ?? 0) + 1;
    env.hunger = Math.max(0, env.hunger - 1);
  }
  env.lefts[p.food] = p.left ?? 0;
  writeEnv(env);
  fs.appendFileSync(log, `${JSON.stringify({ t: Date.now(), food: p.food, ant: p.ant, ...(p.emptied ? { emptied: true } : {}) })}\n`);
  return undefined;
});
