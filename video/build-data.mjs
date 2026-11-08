#!/usr/bin/env node
// Compile one recorded colony run into the video's frozen dataset.
//
//   node build-data.mjs <runDir>                 → data.js (the sound cues come from the composition)
//   node build-data.mjs --stub --seconds 12     → synthetic data.js for smoke tests
//
// The run dir holds the run's own records (nothing is invented here):
//   colony.network.json  the map: every neuron's `at`, the ants' thresholds, the foods' argv, the ground block
//   colony.inputs.jsonl  the clock's ticks (the run's length in seconds)
//   deliveries.jsonl     one line per arrival at the nest: {t, food, ant, emptied?}
//   stream.jsonl         the engine's event stream (ground events, the forwards the recruits ride)
// The scene schedule lives in composition.html; this file only freezes WHAT happened,
// and computes the derived facts the captions quote, so the video never lies.

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MULBERRY = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function readLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}

function fromRun(dir) {
  const net = readJson(path.join(dir, 'colony.network.json'));
  const deliveries = readLines(path.join(dir, 'deliveries.jsonl'));
  const stream = readLines(path.join(dir, 'stream.jsonl'));
  // The run's length: the clock ticks the inputs file carries.
  const tickLines = readLines(path.join(dir, 'colony.inputs.jsonl')).length;
  const ants = [], foods = [];
  const nest = { id: 'nest', at: [0, 0, 0] };
  let tickMs = 250, evap = 0.25, base = 0.05, power = 2, seed = 0;
  for (const n of net.neurons) {
    const at = n.at ?? [0, 0, 0];
    if (n.id === 'clock') continue;
    if (n.id === 'nest') { nest.at = at; continue; }
    if (n.serve && /ant\.mjs/.test(n.serve[1] ?? '')) {
      const argv = n.serve.slice(2);          // ant argv: [id, theta, names, dists]
      ants.push({ id: n.id, at, theta: Number(argv[1]) });
    } else if (n.serve && /food\.mjs/.test(n.serve[1] ?? '')) {
      const argv = n.serve.slice(2);          // food argv: [id, stock, appearsMs, dist]
      foods.push({
        id: String(argv[0]), at,
        total: Number(argv[1]),
        appearMs: Number(argv[2] ?? 0),
        dist: Number(argv[3] ?? Math.round(Math.hypot(at[0], at[1]))),
        drop: String(argv[0]).startsWith('drop-'),
      });
    }
  }
  const seconds = Math.round(tickLines * tickMs / 1000);
  const g = net.ground ?? {};
  if (Number.isFinite(g.evaporate)) evap = g.evaporate;
  if (Number.isFinite(g.base)) base = g.base;
  if (Number.isFinite(g.power)) power = g.power;
  if (Number.isInteger(g.seed)) seed = g.seed;

  // Normalize the deliveries to engine time: the jsonl carries wall times.
  // The first arrival at the nest is the first `signal` from any food to the nest.
  const rel = stream.filter((e) => e.to?.[0] === 'nest');
  let offset = 0;
  if (deliveries.length && rel.length) offset = deliveries[0].t - rel[0].t;
  // Each answered pickup takes one unit; an emptied arrival finds the patch dry
  // and takes nothing. The stock each patch is holding walks with its arrivals.
  const eaten = Object.fromEntries(foods.map((f) => [f.id, 0]));
  const total = Object.fromEntries(foods.map((f) => [f.id, f.total]));
  const trips = deliveries.map((d) => {
    const picked = !d.emptied;
    if (picked) eaten[d.food] += 1;
    return {
      ant: d.ant, food: d.food,
      t: Math.max(0, Math.round(d.t - offset)),
      left: picked ? total[d.food] - eaten[d.food] : 0,
      emptied: Boolean(d.emptied),
    };
  });
  trips.sort((a, b) => a.t - b.t);

  const ground = stream.filter((e) => e.type === 'ground')
    .map((e) => ({ t: e.t, place: e.place, v: e.v }));
  const recruits = stream
    .filter((e) => e.type === 'signal' && (e.from === 'nest' || (e.from.startsWith('ant-') && (e.to ?? []).some((x) => x.startsWith('ant-')))))
    .map((e) => ({ t: e.t, from: e.from, to: e.to ?? [], food: e.payload?.data?.food ?? null }));

  // Facts the captions quote. They are read off the same records, so the video
  // can only say what happened.
  const tripsByAnt = Object.fromEntries(ants.map((a) => [a.id, trips.filter((d) => d.ant === a.id).length]));
  const third = Math.max(1, Math.floor(ants.length / 3));
  const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const ids = ants.map((a) => a.id);
  const eagerAvg = avg(ids.slice(0, third).map((i) => tripsByAnt[i]));
  const reluctantAvg = avg(ids.slice(-third).map((i) => tripsByAnt[i]));
  const lastT = trips.length ? trips[trips.length - 1].t : 0;
  const lastTen = trips.filter((d) => d.t > lastT - 10000);
  const won = (() => {
    const counts = new Map();
    for (const d of lastTen) counts.set(d.food, (counts.get(d.food) ?? 0) + 1);
    let best = null, n = -1;
    for (const [f, c] of counts) if (c > n) { best = f; n = c; }
    return best ?? foods[0]?.id;
  })();
  const dry = {};
  for (const d of trips.filter((x) => x.emptied)) {
    dry[d.food] ??= { t: d.t, wasted: 0 };
    dry[d.food].wasted += 1;
  }
  const drops = foods.filter((f) => f.drop).map((f) => ({
    id: f.id,
    t: Math.round(f.appearMs),
    deliveries: trips.filter((d) => d.food === f.id).length,
  }));
  return {
    version: 1, seconds, tickMs, evap, base, power, seed,
    ants, foods, nest, deliveries: trips, ground, recruits,
    facts: {
      deliveries: trips.length,
      won, dry, drops,
      eagerAvg: Math.round(eagerAvg * 10) / 10,
      reluctantAvg: Math.round(reluctantAvg * 10) / 10,
      ratio: reluctantAvg > 0 ? Math.round((eagerAvg / reluctantAvg) * 10) / 10 : null,
      third,
      settledT: lastT,
      runStartEaten: foods.filter((f) => !f.appearMs).length,
    },
  };
}

function stub(seconds) {
  const rnd = MULBERRY(7);
  const ants = Array.from({ length: 12 }, (_, i) => ({
    id: `ant-${String(i + 1).padStart(2, '0')}`, at: [Math.cos(i) * 90, Math.sin(i) * 90, 0], theta: 2 + i,
  }));
  const foods = [
    { id: 'berries', at: [350, 80, 0], total: 40, appearMs: 0, dist: 360, drop: false },
    { id: 'seeds', at: [-300, 260, 0], total: 220, appearMs: 0, dist: 400, drop: false },
    { id: 'drop-1', at: [120, -420, 0], total: 240, appearMs: seconds * 500, dist: 440, drop: true },
  ];
  const deliveries = [];
  for (let n = 0; n < 40; n++) {
    const f = foods[n % (n < 30 ? 2 : 3)];
    const t = 900 + n * (seconds * 1000 - 1800) / 40 + rnd() * 80;
    deliveries.push({ ant: ants[n % 12].id, food: f.id, t: Math.round(t), left: f.total - n * 2, emptied: n === 22 });
  }
  const ground = [];
  for (const d of deliveries) {
    if (d.emptied) ground.push({ t: d.t, place: d.food, v: -1.5 });
    else ground.push({ t: d.t, place: d.food, v: Math.round((0.4 + rnd() * 1.2) * 100) / 100 });
  }
  const recruits = deliveries.filter((_, i) => i % 5 === 0)
    .map((d, i) => ({ t: d.t, from: i % 2 ? 'nest' : 'ant-01', to: ['ant-03', 'ant-05'], food: d.food }));
  return {
    version: 1, seconds, tickMs: 250, evap: 0.25, base: 0.05, power: 2, seed: 7,
    ants, foods, nest: { id: 'nest', at: [0, 0, 0] },
    deliveries, ground, recruits,
    facts: {
      deliveries: deliveries.length, won: 'drop-1',
      dry: { berries: { t: deliveries[22].t, wasted: 1 } },
      drops: [{ id: 'drop-1', t: seconds * 500, deliveries: 10 }],
      eagerAvg: 7.5, reluctantAvg: 1.9, ratio: 3.9, third: 4,
      settledT: deliveries[39].t, runStartEaten: 2,
    },
  };
}

const args = process.argv.slice(2);
let data;
let outName = 'data.js';
if (args[0] === '--stub') {
  data = stub(Number(args[2] === '--seconds' ? args[3] : 12) || 12);
  if (args.includes('--out')) outName = args[args.indexOf('--out') + 1];
} else {
  data = fromRun(args[0]);
}
const file = path.join(HERE, outName);
fs.writeFileSync(file, `window.COLONY = ${JSON.stringify(data)};\n`);
console.log(`${file}: ${data.deliveries?.length ?? data.facts?.deliveries} arrivals, ${data.ants.length} ants, ${data.foods.length} foods, ${data.ground.length} ground writes, seed ${data.seed}`);
