// The nest: the only writer of the environment. A tick evaporates every trail
// (times rho) and makes the colony hungrier; a delivery feeds it and lays
// pheromone on the trail it came from, more for a shorter trip (ants lay more
// for a better source, so a closer trail can overtake a farther one). It never answers: what it changes is
// the ground the ants read.
import fs from 'node:fs';
import path from 'node:path';
import { readEnv, writeEnv } from './env.mjs';
import { serve } from './serve.mjs';

const RHO = 0.94;
const GROWTH = 0.5;
const DEPOSIT_MS = 600; // pheromone per delivery: DEPOSIT_MS / the trip's ms, more for a closer source
const env = { hunger: 6, pheromone: {}, tick: 0, delivered: {}, ...readEnv() };
const log = path.join(process.env.COLONY_DIR, 'deliveries.jsonl');
writeEnv(env);

serve((p) => {
  if (p && typeof p.tick === 'number') {
    env.tick = p.tick;
    for (const f of Object.keys(env.pheromone)) env.pheromone[f] = Number((env.pheromone[f] * RHO).toFixed(4));
    env.hunger = Math.min(20, env.hunger + GROWTH);
  } else if (p && p.food) {
    env.pheromone[p.food] = (env.pheromone[p.food] ?? 0) + DEPOSIT_MS / (p.trip || DEPOSIT_MS);
    env.delivered[p.food] = (env.delivered[p.food] ?? 0) + 1;
    env.hunger = Math.max(0, env.hunger - 1);
    fs.appendFileSync(log, `${JSON.stringify({ t: Date.now(), tick: env.tick, food: p.food, ant: p.ant })}\n`);
  }
  writeEnv(env);
  return undefined;
}, { maxInflight: 1 });
