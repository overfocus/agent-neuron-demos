// One ant. argv: its id, its response threshold, the food ids, each food's
// distance in ms, every ant's id, and this ant's three nearest ants. On each
// tick of the clock it decides for itself:
//   - busy on a trip: quiet;
//   - else it forages with probability s^2 / (s^2 + theta^2), s the nest's
//     hunger (a response threshold: Bonabeau et al.);
//   - a forager answers for the patch the colony last drummed about - the
//     nest's broadcast carried {food, add, left} - or, before any drum, a
//     live Math.random pick, and names NO to: the trails live in the engine
//     now (the network file's ground, agent-neuron decision 0012), and the
//     engine's seeded draw routes the trip message along one link by
//     max(0, base + ground[to])^power. That is usually the strong trail's
//     food, and occasionally a nearest nestmate - the tiny base mass on
//     links whose place has no deposit. That leak is recruitment. The ant's
//     own epsilon explorer is gone: the base mass is the explorer now.
// A recruited ant - any signal whose payload names a food and is not a clock
// tick: a nestmate's trip message or the nest's drumbeat - answers with just
// that food and takes the trip now if idle, the drum exciting it exactly as a
// returning forager would: through its threshold roll (without the roll every
// drum recruits the whole idle pool at once, and no ant keeps a threshold).
// A busy ant ignores the signal. An ant never re-broadcasts a recruit it
// received.
import { readEnv } from './env.mjs';
import { serve, sleep } from './serve.mjs';

const [antId, theta, foodsArg, distArg, antsArg, neisArg] = process.argv.slice(2);
const foods = foodsArg.split(',');
const dist = Object.fromEntries(distArg.split(',').map((d, i) => [foods[i], Number(d)]));
const ants = antsArg ? antsArg.split(',') : [];
const neighbours = neisArg ? neisArg.split(',') : [];
const THETA = Number(theta);
let busyUntil = 0;
let rumour = null; // the patch the colony last drummed about
const heard = new Map(); // left at each food, as last heard

// A nestmate's trip message or the nest's drumbeat: a payload that names a
// food, from anything that is not the clock.
const isRecruit = (p) => p && typeof p === 'object' && typeof p.food === 'string' && !('tick' in p);

const pickup = (food) => ({ ant: antId, food, trip: dist[food], left: heard.get(food) ?? 0 });

serve(
  async (p, m) => {
    if (Date.now() < busyUntil) return undefined;
    if (isRecruit(p)) {
      const food = String(p.food);
      if (!(food in dist)) return undefined;
      heard.set(food, p.left);
      rumour = food;
      const s = readEnv().hunger;
      if (Math.random() >= (s * s) / (s * s + THETA * THETA)) return undefined;
      busyUntil = Date.now() + 2 * dist[food];
      await sleep(dist[food]);
      return { payload: pickup(food), to: [food] }; // to the food alone: no re-broadcast
    }
    const s = readEnv().hunger;
    if (Math.random() >= (s * s) / (s * s + THETA * THETA)) return undefined;
    const food = rumour && rumour in dist ? rumour : foods[Math.floor(Math.random() * foods.length)];
    busyUntil = Date.now() + 2 * dist[food];
    await sleep(dist[food]);
    return { payload: pickup(food) }; // no to: the engine's draw picks its food
  },
  { maxInflight: 16 },
);
