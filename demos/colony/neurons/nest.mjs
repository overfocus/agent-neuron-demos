// The nest: feeds on deliveries and lays the trail, more for a shorter trip
// (ants lay more for a better source, so a closer trail can overtake a farther
// one): 600 over the arrival's trip milliseconds, carried as the answer's add
// into the engine's ground (the network file's ground block; the engine ages
// and evaporates the place). An arrival that found the patch empty carries
// emptied: it feeds nothing, its add marks the trail dead (a negative add
// lowers the place) and the instant of the first such arrival is kept in
// env.json. What each food last said it had is kept in lefts; the colony's
// hunger grows on env.json between writes and rides down with every delivery.
// EVERY arrival is answered, emptied or not: the payload {food, add, left}
// goes to every ant along the nest's declared links - the colony's drumbeat:
// every ant hears the true stock and its route.
import fs from 'node:fs';
import path from 'node:path';
import { readEnv, writeEnv } from './env.mjs';
import { serve } from './serve.mjs';

const DEPOSIT_MS = 600; // pheromone per delivery: DEPOSIT_MS / the trip's ms
const DEAD_MARK = -0.5; // an emptied arrival lowers the trail: it is dead
const log = path.join(process.env.COLONY_DIR, 'deliveries.jsonl');
const ants = process.argv[2] ? process.argv[2].split(',') : [];
writeEnv(readEnv());

serve((p) => {
  if (!p?.food) return undefined;
  const env = readEnv();
  env.dead ??= {};
  env.lefts ??= {};
  if (p.emptied) env.dead[p.food] ??= Date.now();
  else env.hunger = Math.max(0, env.hunger - 1);
  env.lefts[p.food] = p.left ?? 0;
  writeEnv(env);
  fs.appendFileSync(log, `${JSON.stringify({ t: Date.now(), food: p.food, ant: p.ant, ...(p.emptied ? { emptied: true } : {}) })}\n`);
  return {
    payload: { food: p.food, add: p.emptied ? DEAD_MARK : DEPOSIT_MS / (p.trip || DEPOSIT_MS), left: p.left ?? 0 },
    to: ants, // every ant: the colony's drumbeat
  };
}, { maxInflight: 16 });
