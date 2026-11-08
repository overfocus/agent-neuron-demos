// The colony: n ants, a few food sources, a nest, and no one in charge.
//
//   npm run demo colony                          24 ants, 45 seconds
//   npm run demo colony -- --ants 40 --seconds 60
//
// Every ant is its own long-lived process (a serve neuron) with its own
// response threshold; every food source holds its own stock. The only shared
// thing is the ground: env.json, written by the nest alone (pheromone per
// trail, the colony's hunger) and read by every ant. Ants that pass their
// threshold go foraging, follow trails in proportion to their pheromone (and
// sometimes explore), and the trail they come back on gets stronger; every
// tick, all trails evaporate. A forager also recruits the ants nearest it: an
// idle one follows to the same food at once, skipping its own threshold, and
// never re-broadcasts a recruit it received. The nearest food runs out; a new
// patch appears halfway through. Watch the traffic move.
//
// Three more patches, the drop sites, are drawn by mulberry32 from --seed
// (default 11): distance 500-1400 ms, stock 200-400, an angle anywhere round
// the nest, and an appear time inside 0.3-0.8 of the run. Same seed, same
// schedule, so takes and tests reproduce; --seed 0 means an unseeded draw: a
// different map every take.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDir } from '../../lib/engine.mjs';
import { startRun } from '../../lib/run.mjs';
import { readEnv } from './neurons/env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const N = (f) => path.join(HERE, 'neurons', f);
const TICK_MS = 250;

export const meta = {
  name: 'colony',
  title: 'The colony: n ants, food, and no one in charge',
  about: 'Response thresholds, pheromone trails and evaporation, with every ant its own neuron and the ground as the only shared state.',
  variants: ['--ants <n>', '--seconds <s>', '--seed <n>'],
};

/**
 * The food sources: near and small, middling, far and rich, and one that
 * appears later. `angle` places each on the map around the nest (degrees),
 * at its distance: the map's unit is a millisecond of walking. The berries
 * and the late honeydew are on opposite sides, so the switch crosses the map.
 */
export const FOODS = [
  { id: 'berries', distance: 400, stock: 60, appears: 0, angle: 20, about: 'near, small: runs out part-way' },
  { id: 'seeds', distance: 1000, stock: 400, appears: 0, angle: 115, about: 'middle distance, plenty' },
  { id: 'carcass', distance: 1400, stock: 400, appears: 0, angle: 290, about: 'far, plenty' },
  { id: 'honeydew', distance: 450, stock: 400, appears: 0.25, angle: 200, about: 'near, plenty, appears a quarter of the way in' },
];

const round = (v) => Math.round(v * 10) / 10;

/**
 * The drop-site draw: three extra patches from `--seed` via mulberry32, each
 * 500-1400 ms from the nest, 200-400 units, any angle round the nest,
 * appearing inside 0.3-0.8 of the run. The same seed always draws the same
 * schedule, so takes and tests reproduce; `--seed 0` leaves the draw to
 * Math.random: a different map every take.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const drawDrops = (seed) => {
  const draw = seed === 0 ? Math.random : mulberry32(seed);
  return Array.from({ length: 3 }, (_, i) => ({
    id: `drop-${i + 1}`,
    distance: Math.round(500 + draw() * 900),
    stock: Math.round(200 + draw() * 200),
    angle: draw() * 360,
    appears: 0.3 + draw() * 0.5,
    about: 'a seeded drop site, drawn from the run seed',
  }));
};

/** Where each neuron sits (decision 0011's `at`): the nest at the origin, food at its distance, ants on a shell round the nest. */
function mapOf(antIds, foods) {
  const at = { nest: [0, 0, 0], clock: [-1100, 900, -200] };
  for (const f of foods) {
    const a = (f.angle * Math.PI) / 180;
    at[f.id] = [round(f.distance * Math.cos(a)), round(f.distance * Math.sin(a)), 0];
  }
  // A Fibonacci shell: evenly spread, the same every run.
  const n = antIds.length;
  antIds.forEach((id, i) => {
    const y = n === 1 ? 0 : 1 - (2 * i) / (n - 1);
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    at[id] = [round(90 * r * Math.cos(phi)), round(90 * y), round(90 * r * Math.sin(phi))];
  });
  return at;
}

/**
 * Each ant's three nearest ants on the shell (Euclidean in the map's coords):
 * the links a forager recruits along. A pair may be declared both ways - the
 * k-nearest sets of two neighbouring ants usually name each other.
 */
function nearestOf(at, antIds, k = 3) {
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  return Object.fromEntries(
    antIds.map((a) => [
      a,
      antIds
        .filter((b) => b !== a)
        .map((b) => [d(at[a], at[b]), b])
        .sort((x, y) => x[0] - y[0])
        .slice(0, k)
        .map(([, b]) => b),
    ]),
  );
}

export function buildNetwork(dir, ants, seconds, seed = 11) {
  const drops = drawDrops(seed);
  const foods = [...FOODS, ...drops];
  const names = foods.map((f) => f.id).join(',');
  const dists = foods.map((f) => f.distance).join(',');
  const antIds = Array.from({ length: ants }, (_, i) => `ant-${String(i + 1).padStart(2, '0')}`);
  // Thresholds spread from eager (2) to reluctant (14): a colony of
  // individuals, not copies.
  const theta = (i) => (ants === 1 ? 6 : 2 + (12 * i) / (ants - 1)).toFixed(1);
  const at = mapOf(antIds, foods);
  const neighbours = nearestOf(at, antIds);
  const net = {
    version: 0,
    name: 'colony',
    description: `${ants} ants, ${foods.length} food sources (three of them drop sites, drawn by seed ${seed}), one nest. No neuron assigns work: each ant decides by its own threshold against the colony's hunger, picks a trail by its pheromone, and recruits its three nearest ants. The nest alone writes the ground (env.json); every ant reads it.`,
    neurons: [
      { id: 'clock', description: `A tick every ${TICK_MS} ms: each ant's moment to decide.`, at: at.clock, source: true },
      { id: 'nest', at: at.nest, description: 'Feeds on deliveries and lays pheromone on the trail each came from (more for a shorter trip). Marks a trail dead when an arrival finds its patch empty. The only writer of env.json; time evaporates the trails and raises the hunger between writes. Never answers.', serve: ['node', N('nest.mjs')], env: ['COLONY_DIR'] },
      ...antIds.map((id, i) => ({
        id,
        at: at[id],
        // maxHops 2: an ant hears the clock (0 hops) and a recruiter's forward
        // (2 hops), and nothing deeper - so recruitment is one hop and a
        // ant-to-ant cycle is legal to the engine's cycle rule.
        maxHops: 2,
        description: `An ant with response threshold ${theta(i)}: forages when the colony is hungry enough for it, follows trails by their pheromone, and recruits its three nearest ants (an idle one follows at once).`,
        serve: ['node', N('ant.mjs'), id, theta(i), names, dists, antIds.join(','), (neighbours[id] ?? []).join(',')],
        env: ['COLONY_DIR'],
      })),
      ...foods.map((f) => ({
        id: f.id,
        at: at[f.id],
        description: `Food, ${f.about}: ${f.stock} units, ${f.distance} ms from the nest${f.appears ? `, appears at ${Math.round(f.appears * seconds)} s` : ''}.`,
        serve: ['node', N('food.mjs'), String(f.stock), String(Math.round(f.appears * seconds * 1000))],
      })),
    ],
    links: [
      ...antIds.map((a) => ({ from: 'clock', to: a })),
      ...antIds.flatMap((a) => (neighbours[a] ?? []).map((b) => ({ from: a, to: b }))),
      ...antIds.flatMap((a) => foods.map((f) => ({ from: a, to: f.id }))),
      ...foods.map((f) => ({ from: f.id, to: 'nest' })),
    ],
  };
  const file = path.join(dir, 'colony.network.json');
  fs.writeFileSync(file, JSON.stringify(net, null, 2));
  const ticks = Math.floor((seconds * 1000) / TICK_MS);
  const inputs = path.join(dir, 'colony.inputs.jsonl');
  fs.writeFileSync(inputs, Array.from({ length: ticks }, (_, n) => JSON.stringify({ at: n * TICK_MS, source: 'clock', payload: { tick: n } })).join('\n') + '\n');
  return {
    file,
    inputs,
    antIds,
    theta,
    foods,
    drops: drops.map((d) => ({ id: d.id, appear: Math.round(d.appears * seconds * 10) / 10 })),
  };
}

const flag = (flags, name, dflt) => {
  const i = flags.indexOf(name);
  return i >= 0 && flags[i + 1] ? Number(flags[i + 1]) : dflt;
};

export async function main({ flags = [], say = console.log } = {}) {
  const ants = Math.max(1, Math.min(200, flag(flags, '--ants', 24)));
  const seconds = Math.max(5, Math.min(600, flag(flags, '--seconds', 45)));
  const seedReq = flag(flags, '--seed', 11);
  const seed = Number.isFinite(seedReq) && seedReq >= 0 ? Math.floor(seedReq) : 11; // 0: an unseeded draw
  const dir = runDir('colony');
  process.env.COLONY_DIR = dir; // readEnv, for the progress lines
  const { file, inputs, antIds, theta, foods, drops } = buildNetwork(dir, ants, seconds, seed);
  say(`${ants} ants, ${foods.length} food sources (3 of them drop sites drawn by seed ${seed}${seed === 0 ? ', unseeded: a different map every take' : ''}), ${seconds} s.`);
  say(`  Foods: ${foods.map((f) => `${f.id} (${f.about})`).join('; ')}.`);

  let lastShown = -1;
  const narrated = new Set(); // foods whose dry moment has been narrated once
  const wasteSeen = new Map(); // emptied arrivals each food has answered, as seen
  const foodIds = new Set(foods.map((f) => f.id));
  const run = startRun({
    name: 'colony',
    title: meta.title,
    dir,
    network: file,
    inputs,
    env: { COLONY_DIR: dir },
    walk: antIds,
    onEvent: (ev) => {
      if (ev.type === 'signal' && ev.from === 'clock') {
        const sec = Math.floor(ev.t / 5000);
        if (sec === lastShown) return;
        lastShown = sec;
        try {
          const env = readEnv();
          const trails = foods.map((f) => `${f.id} ${(env.pheromone[f.id] ?? 0).toFixed(1).padStart(5)}`).join('  ');
          const lefts = foods.map((f) => `${f.id} ${String(env.lefts?.[f.id] ?? '-')}`).join(' ');
          say(`${String(sec * 5).padStart(3)} s  hunger ${env.hunger.toFixed(1).padStart(4)}  trails: ${trails}  stock: ${lefts}`);
        } catch {
          // the nest has not written yet
        }
        return;
      }
      // A food answering emptied: the first time, the patch went dry. Later
      // ones are the wasted arrivals the final report counts from the log.
      const d = ev.payload?.data;
      if (ev.type === 'answer' && d?.emptied && foodIds.has(ev.from)) {
        const n = (wasteSeen.get(ev.from) ?? 0) + 1;
        wasteSeen.set(ev.from, n);
        if (!narrated.has(ev.from)) {
          narrated.add(ev.from);
          say(`${ev.from} ran dry at ${Math.round(ev.t / 1000)} s: ${n} wasted trip${n === 1 ? '' : 's'} so far.`);
        }
      }
    },
  });
  const { code } = await run.done;

  const deliveries = fs.existsSync(path.join(dir, 'deliveries.jsonl'))
    ? fs.readFileSync(path.join(dir, 'deliveries.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const t0 = run.started;
  const windows = Math.ceil(seconds / 5);
  say('');
  say('Deliveries per 5 seconds, by food (the traffic moves when a trail runs dry or a better one appears):');
  say(`  ${'s'.padStart(5)}  ${foods.map((f) => f.id.padStart(9)).join('')}  foragers`);
  const table = [];
  for (let w = 0; w < windows; w++) {
    const inW = deliveries.filter((d) => Math.floor((d.t - t0) / 5000) === w);
    const row = foods.map((f) => inW.filter((d) => d.food === f.id && !d.emptied).length);
    table.push(row);
    say(`  ${String(w * 5).padStart(5)}  ${row.map((n) => String(n).padStart(9)).join('')}  ${String(new Set(inW.map((d) => d.ant)).size).padStart(8)}`);
  }
  // Division of labour: the eager ants (low threshold) should do most trips.
  const trips = Object.fromEntries(antIds.map((a) => [a, deliveries.filter((d) => d.ant === a).length]));
  const third = Math.max(1, Math.floor(ants / 3));
  const eager = antIds.slice(0, third).reduce((s, a) => s + trips[a], 0) / third;
  const reluctant = antIds.slice(-third).reduce((s, a) => s + trips[a], 0) / third;
  say('');
  say(`Trips per ant: the eagerest third (threshold ${theta(0)}-${theta(third - 1)}) averaged ${eager.toFixed(1)}, the most reluctant third (${theta(ants - third)}-${theta(ants - 1)}) ${reluctant.toFixed(1)}.`);
  const last = table.slice(-2).reduce((acc, row) => acc.map((n, i) => n + row[i]), foods.map(() => 0));
  const won = foods[last.indexOf(Math.max(...last))];
  say(`At the end the colony was mostly on ${won.id} (${won.about}). Runs differ: a trail that takes hold early can keep the traffic even after a closer source appears, as real colonies do.`);
  // The dry patches: an emptied arrival is a wasted trip. The log's first
  // emptied line per food is when it went dry; every emptied arrival for it
  // from that one on is its wasted-trip count.
  const emptiedLines = deliveries.filter((d) => d.emptied);
  const firstDry = {};
  const wasted = Object.fromEntries(foods.map((f) => [f.id, 0]));
  for (const d of emptiedLines) wasted[d.food] += 1;
  for (const d of emptiedLines) if (firstDry[d.food] === undefined || d.t < firstDry[d.food]) firstDry[d.food] = d.t;
  const dry = foods.filter((f) => firstDry[f.id] !== undefined);
  say('');
  say(dry.length
    ? 'Dry patches, each arrival that found nothing after the first one a wasted trip:'
    : 'No patch ran dry this take.');
  for (const f of dry) say(`  ${f.id} went dry at ${Math.round((firstDry[f.id] - t0) / 1000)} s: ${wasted[f.id]} wasted trips since it did.`);
  const dropsOut = drops.map((d) => ({ ...d, drawn: deliveries.filter((x) => x.food === d.id && !x.emptied).length }));
  say('');
  say(`The drop sites, drawn by seed ${seed}: ${dropsOut.map((d) => `${d.id} appearing at ${d.appear} s, ${d.drawn} deliver${d.drawn === 1 ? 'y' : 'ies'} drawn`).join('; ')}.`);
  say(`${deliveries.filter((d) => !d.emptied).length} deliveries in all, ${emptiedLines.length} arrivals wasted on dry patches. Trace: ${run.files.trace}`);
  return {
    code,
    deliveries,
    table,
    eager,
    reluctant,
    won: won.id,
    events: run.events.length,
    empties: dry.map((f) => ({ food: f.id, at: Math.round((firstDry[f.id] - t0) / 1000) })),
    wasted,
    drops: dropsOut,
    seed,
  };
}
