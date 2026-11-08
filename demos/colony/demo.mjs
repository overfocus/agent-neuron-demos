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
// tick, all trails evaporate. The nearest food runs out; a new patch appears
// halfway through. Watch the traffic move.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDir } from '../../lib/engine.mjs';
import { startRun } from '../../lib/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const N = (f) => path.join(HERE, 'neurons', f);
const TICK_MS = 250;

export const meta = {
  name: 'colony',
  title: 'The colony: n ants, food, and no one in charge',
  about: 'Response thresholds, pheromone trails and evaporation, with every ant its own neuron and the ground as the only shared state.',
  variants: ['--ants <n>', '--seconds <s>'],
};

/** The food sources: near and small, middling, far and rich, and one that appears later. */
export const FOODS = [
  { id: 'berries', distance: 400, stock: 35, appears: 0, about: 'near, small: runs out early' },
  { id: 'seeds', distance: 800, stock: 400, appears: 0, about: 'middle distance, plenty' },
  { id: 'carcass', distance: 1400, stock: 400, appears: 0, about: 'far, plenty' },
  { id: 'honeydew', distance: 450, stock: 400, appears: 0.45, about: 'near, plenty, appears part-way' },
];

export function buildNetwork(dir, ants, seconds) {
  const names = FOODS.map((f) => f.id).join(',');
  const dists = FOODS.map((f) => f.distance).join(',');
  const antIds = Array.from({ length: ants }, (_, i) => `ant-${String(i + 1).padStart(2, '0')}`);
  // Thresholds spread from eager (2) to reluctant (14): a colony of
  // individuals, not copies.
  const theta = (i) => (ants === 1 ? 6 : 2 + (12 * i) / (ants - 1)).toFixed(1);
  const net = {
    version: 0,
    name: 'colony',
    description: `${ants} ants, ${FOODS.length} food sources, one nest. No neuron assigns work: each ant decides by its own threshold against the colony's hunger, and picks a trail by its pheromone. The nest alone writes the ground (env.json); every ant reads it.`,
    neurons: [
      { id: 'clock', description: `A tick every ${TICK_MS} ms: time passing, for every ant and for the nest.`, source: true },
      { id: 'nest', description: 'Feeds on deliveries and lays pheromone on the trail each came from; evaporates every trail on each tick; raises the hunger. Writes env.json, never answers.', serve: ['node', N('nest.mjs')], env: ['COLONY_DIR'] },
      ...antIds.map((id, i) => ({
        id,
        description: `An ant with response threshold ${theta(i)}: forages when the colony is hungry enough for it, follows trails by their pheromone.`,
        serve: ['node', N('ant.mjs'), id, theta(i), names, dists],
        env: ['COLONY_DIR'],
      })),
      ...FOODS.map((f) => ({
        id: f.id,
        description: `Food, ${f.about}: ${f.stock} units, ${f.distance} ms from the nest${f.appears ? `, appears at ${Math.round(f.appears * seconds)} s` : ''}.`,
        serve: ['node', N('food.mjs'), String(f.stock), String(Math.round(f.appears * seconds * 1000))],
      })),
    ],
    links: [
      { from: 'clock', to: 'nest' },
      ...antIds.map((a) => ({ from: 'clock', to: a })),
      ...antIds.flatMap((a) => FOODS.map((f) => ({ from: a, to: f.id }))),
      ...FOODS.map((f) => ({ from: f.id, to: 'nest' })),
    ],
  };
  const file = path.join(dir, 'colony.network.json');
  fs.writeFileSync(file, JSON.stringify(net, null, 2));
  const ticks = Math.floor((seconds * 1000) / TICK_MS);
  const inputs = path.join(dir, 'colony.inputs.jsonl');
  fs.writeFileSync(inputs, Array.from({ length: ticks }, (_, n) => JSON.stringify({ at: n * TICK_MS, source: 'clock', payload: { tick: n } })).join('\n') + '\n');
  return { file, inputs, antIds, theta };
}

const flag = (flags, name, dflt) => {
  const i = flags.indexOf(name);
  return i >= 0 && flags[i + 1] ? Number(flags[i + 1]) : dflt;
};

export async function main({ flags = [], say = console.log } = {}) {
  const ants = Math.max(1, Math.min(200, flag(flags, '--ants', 24)));
  const seconds = Math.max(5, Math.min(600, flag(flags, '--seconds', 45)));
  const dir = runDir('colony');
  const { file, inputs, antIds, theta } = buildNetwork(dir, ants, seconds);
  say(`${ants} ants, ${FOODS.length} food sources, ${seconds} s. Foods: ${FOODS.map((f) => `${f.id} (${f.about})`).join('; ')}.`);

  let lastShown = -1;
  const run = startRun({
    name: 'colony',
    title: meta.title,
    dir,
    network: file,
    inputs,
    env: { COLONY_DIR: dir },
    onEvent: (ev) => {
      if (ev.type !== 'signal' || ev.from !== 'clock') return;
      const sec = Math.floor(ev.t / 5000);
      if (sec === lastShown) return;
      lastShown = sec;
      try {
        const env = JSON.parse(fs.readFileSync(path.join(dir, 'env.json'), 'utf8'));
        const trails = FOODS.map((f) => `${f.id} ${(env.pheromone[f.id] ?? 0).toFixed(1).padStart(5)}`).join('  ');
        say(`${String(sec * 5).padStart(3)} s  hunger ${env.hunger.toFixed(1).padStart(4)}  trails: ${trails}`);
      } catch {
        // the nest has not written yet
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
  say(`  ${'s'.padStart(5)}  ${FOODS.map((f) => f.id.padStart(9)).join('')}  foragers`);
  const table = [];
  for (let w = 0; w < windows; w++) {
    const inW = deliveries.filter((d) => Math.floor((d.t - t0) / 5000) === w);
    const row = FOODS.map((f) => inW.filter((d) => d.food === f.id).length);
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
  const last = table.slice(-2).reduce((acc, row) => acc.map((n, i) => n + row[i]), FOODS.map(() => 0));
  const won = FOODS[last.indexOf(Math.max(...last))];
  say(`At the end the colony was mostly on ${won.id} (${won.about}). Runs differ: a trail that takes hold early can keep the traffic even after a closer source appears, as real colonies do.`);
  say(`${deliveries.length} deliveries in all. Trace: ${run.files.trace}`);
  return { code, deliveries, table, eager, reluctant, won: won.id, events: run.events.length };
}
