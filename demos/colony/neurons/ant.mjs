// One ant. argv: its id, its response threshold, the food ids, each food's
// distance in ms, every ant's id, and this ant's three nearest ants. On each
// tick of the clock it decides for itself:
//   - busy on a trip: quiet;
//   - else it forages with probability s^2 / (s^2 + theta^2), s the nest's
//     hunger (a response threshold: Bonabeau et al.);
//   - a forager follows the trails: food f with weight (tau + pheromone_f)^alpha,
//     or explores uniformly with probability epsilon;
//   - the answer goes to the food it picked, so its link carries the traffic -
//     and to its three nearest ants, a recruitment: an idle one follows the
//     same food at once, skipping the hunger-threshold roll. A busy ant
//     ignores a recruit, and an ant never re-broadcasts one it received.
// A recruit is any signal from another ant whose payload carries ant, food,
// trip and left; `left` is the sender's last-heard stock there - a rumour
// ants repeat, which the recruit only ever rides along.
import { readEnv } from './env.mjs';
import { serve, sleep } from './serve.mjs';

const [antId, theta, foodsArg, distArg, antsArg, neisArg] = process.argv.slice(2);
const foods = foodsArg.split(',');
const dist = Object.fromEntries(distArg.split(',').map((d, i) => [foods[i], Number(d)]));
const ants = antsArg ? antsArg.split(',') : [];
const neighbours = neisArg ? neisArg.split(',') : [];
const THETA = Number(theta);
const TAU = 0.5;
const ALPHA = 2;
const EPSILON = 0.12;
let busyUntil = 0;
const heard = new Map(); // left at each food, as last heard from a recruiter

const isRecruit = (p, from) =>
  p && typeof p === 'object' && ants.includes(from) &&
  ['ant', 'food', 'trip', 'left'].every((k) => k in p) && !('tick' in p);

function pick(ph, dead) {
  if (Math.random() < EPSILON) return foods[Math.floor(Math.random() * foods.length)];
  const w = foods.map((f) => (dead?.[f] ? 0 : (TAU + (ph[f] ?? 0)) ** ALPHA));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return foods[Math.floor(Math.random() * foods.length)];
  let r = Math.random() * total;
  for (let i = 0; i < foods.length; i++) if ((r -= w[i]) <= 0) return foods[i];
  return foods[foods.length - 1];
}

const pickup = (food) => ({ ant: antId, food, trip: dist[food], left: heard.get(food) ?? 0 });

serve(
  async (p, m) => {
    if (Date.now() < busyUntil) return undefined;
    if (isRecruit(p, m?.from)) {
      const food = String(p.food);
      if (!(food in dist)) return undefined;
      heard.set(food, p.left);
      busyUntil = Date.now() + 2 * dist[food];
      await sleep(dist[food]);
      return { payload: pickup(food), to: [food] }; // to the food alone: no re-broadcast
    }
    const env = readEnv();
    const s = env.hunger;
    if (Math.random() >= (s * s) / (s * s + THETA * THETA)) return undefined;
    const food = pick(env.pheromone, env.dead);
    busyUntil = Date.now() + 2 * dist[food];
    await sleep(dist[food]);
    return { payload: pickup(food), to: [food, ...neighbours] };
  },
  { maxInflight: 16 },
);
