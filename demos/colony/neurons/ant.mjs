// One ant. argv: its id, its response threshold, the food ids, and each food's
// distance in ms. On each tick from the nest it decides for itself:
//   - busy on a trip: quiet;
//   - else it forages with probability s^2 / (s^2 + theta^2), s the nest's
//     hunger (a response threshold: Bonabeau et al.);
//   - a forager follows the trails: food f with weight (tau + pheromone_f)^alpha,
//     or explores uniformly with probability epsilon;
//   - the trip out takes the food's distance; the answer goes to that one
//     food (reply `to`), so its link carries the traffic.
import { readEnv } from './env.mjs';
import { serve, sleep } from './serve.mjs';

const [antId, theta, foodsArg, distArg] = process.argv.slice(2);
const foods = foodsArg.split(',');
const dist = Object.fromEntries(distArg.split(',').map((d, i) => [foods[i], Number(d)]));
const THETA = Number(theta);
const TAU = 0.5;
const ALPHA = 2;
const EPSILON = 0.12;
let busyUntil = 0;

function pick(ph) {
  if (Math.random() < EPSILON) return foods[Math.floor(Math.random() * foods.length)];
  const w = foods.map((f) => (TAU + (ph[f] ?? 0)) ** ALPHA);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < foods.length; i++) if ((r -= w[i]) <= 0) return foods[i];
  return foods[foods.length - 1];
}

serve(
  async () => {
    if (Date.now() < busyUntil) return undefined;
    const env = readEnv();
    const s = env.hunger;
    if (Math.random() >= (s * s) / (s * s + THETA * THETA)) return undefined;
    const food = pick(env.pheromone);
    busyUntil = Date.now() + 2 * dist[food];
    await sleep(dist[food]);
    return { payload: { ant: antId, food, trip: dist[food], theta: THETA }, to: [food] };
  },
  { maxInflight: 8 },
);
