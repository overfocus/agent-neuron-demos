#!/usr/bin/env node
// Compile one recorded backlog run into the video's frozen dataset.
//
//   node build-data-backlog.mjs <runDir>          → data-backlog.js
//
// The run dir holds the run's own records:
//   backlog.network.json  the three lanes and their stations (source names)
//   backlog.inputs.jsonl  the injected items (the run's length)
//   backlog.data.json     the items as written (for titles)
//   stream.jsonl          the engine's events: answers from rules/land/plan/record,
//                         the person neurons (ada-req, lin-arch, ...) and the budget refusal
//   landed.jsonl          how each bug landed (auto or by the lead)
//   stderr.log            the desk lines: who chose what, why
// The board and the scene schedule live in composition-backlog.html.

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const readLines = (f) => {
  try { return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); }
  catch { return []; }
};
const WHO = { 'ada-req': 'ada', 'lin-req': 'lin', 'ada-arch': 'ada', 'lin-arch': 'lin', 'lead-bugs': 'sam', 'lead-arch': 'sam' };

function fromRun(dir) {
  // The backlog's network is a tracked file (the demo does not copy it into
  // the run); the run's own records are everything else.
  const netFile = path.join(HERE, '..', 'demos', 'backlog', 'backlog.network.json');
  const net = readJson(netFile);
  const stream = readLines(path.join(dir, 'stream.jsonl'));
  const landedFile = readLines(path.join(dir, 'landed.jsonl'));
  const stderr = fs.readFileSync(path.join(dir, 'stderr.log'), 'utf8');

  // Stations and their coordinates the composition lays out.
  const laneOf = {};
  for (const n of net.neurons) {
    if (n.source) laneOf[n.id] = 'in';
  }
  const names = net.neurons.map((n) => n.id).filter((id) => !['bugs', 'requirements', 'architecture'].includes(id));

  // Every item's journey: the stations it reached, in order, first touch wins.
  const items = new Map();
  const t0 = stream[0]?.t ?? 0;
  for (const e of stream) {
    if (e.type === 'signal' && ['bugs', 'requirements', 'architecture'].includes(e.from)) {
      const d = e.payload?.data ?? {};
      if (d.id) items.set(d.id, {
        id: d.id, title: d.title ?? '', severity: d.severity ?? '',
        lane: e.from.slice(0, -1),
        budget: e.budget ? 'low' : 'full',
        tIn: e.t, stations: [{ s: e.from, t: e.t }],
      });
    } else if (e.type === 'answer' && e.from && !e.from.endsWith('req') && !e.from.endsWith('arch') &&
               e.from !== 'lead-bugs' && e.from !== 'lead-arch' && !['rules', 'land', 'plan', 'record', 'council'].includes(e.from)) {
      // agent neurons (fixer, spec, adr): reach the station
      const id = e.payload?.data?.id ?? idFromText(e.payload?.data?.text ?? e.payload?.text ?? '');
      if (id && items.has(id)) items.get(id).stations.push({ s: e.from, t: e.t });
    } else if (e.type === 'answer' && ['rules', 'land', 'plan', 'record', 'council'].includes(e.from)) {
      const id = e.payload?.data?.id ?? idFromText(textOf(e.payload));
      const it = id && items.get(id);
      if (it) {
        it.stations.push({ s: e.from, t: e.t });
        if (e.from === 'rules' && id) {
          it.verdict = e.payload?.data?.verdict ?? 'clean';
          it.rulesT = e.t;
        }
      }
    } else if (e.type === 'error' && e.code === 'budget') {
      const id = e.payload?.data?.id ?? idFromText(e.message ?? '');
      const it = id && items.get(id);
      if (it) { it.stations.push({ s: e.neuron, t: e.t, died: true }); it.budget = 'low'; }   // the work never starts
    }
  }
  const itemsArr = [...items.values()];
  itemsArr.sort((a, b) => a.tIn - b.tIn);

  // The desk's record: one line per accepted answer — item, kind, text
  // (option and id), by, and the person's own `why` (decision 0010's
  // recording convention). Timed by the person neurons' replies about the
  // same item.
  const person = stream.filter((e) => (e.type === 'answer' || e.type === 'quiet') && WHO[e.from]);
  const ledger = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/^desk answer: ({.*})/);
    if (!m) continue;
    let a; try { a = JSON.parse(m[1]); } catch { continue; }
    const id = idFromText(a.text ?? a.option ?? '');
    ledger.push({ who: a.by, choice: a.option, id, why: a.why ?? '', text: a.text ?? '' });
  }
  for (const l of ledger) {
    const e = person.find((p) => WHO[p.from] === l.who && textOf(p.payload).includes(l.id ?? ''));
    l.t = e ? e.t : undefined;
  }
  ledger.sort((a, b) => (a.t ?? 9e9) - (b.t ?? 9e9));

  const answerAt = (from, match) => {
    const e = stream.filter((x) => x.type === 'answer' && x.from === from && textOf(x.payload).includes(match));
    return e.map((x) => ({ t: x.t, text: textOf(x.payload) }));
  };
  const firstT = (from, match) => answerAt(from, match)[0]?.t;
  const refused = stream.filter((e) => e.type === 'error' && e.code === 'budget')
    .map((e) => ({ t: e.t, id: e.payload?.data?.id ?? '', neuron: e.neuron, message: e.message }));

  const seconds = Math.ceil(((stream[stream.length - 1]?.t ?? 6000) + 500) / 1000);
  const facts = {
    bugs: itemsArr.filter((i) => i.lane === 'bug').length, requirements: itemsArr.filter((i) => i.lane === 'requirement').length,
    architecture: itemsArr.filter((i) => i.lane === 'architectur').length,
    landedAuto: landedFile.filter((l) => l.how === 'auto').length,
    landedLead: landedFile.filter((l) => l.how === 'lead').length,
    flagged: [...new Set(itemsArr.filter((i) => (i.verdict ?? 'clean') !== 'clean').map((i) => i.id))],
    refused: refused.length,
    scheduled: answerAt('plan', 'scheduled').map((x) => x.text),
    sentBack: answerAt('plan', 'sent').map((x) => x.text),
    records: answerAt('record', 'ARCH').map((x) => x.text),
    decisions: ledger.length,
  };
  return {
    version: 1, seconds, fps: 60,
    names, landed: landedFile,
    items: itemsArr, ledger, refused,
    beats: {
      firstFlag: itemsArr.filter((i) => (i.verdict ?? '') !== 'clean').sort((a, b) => a.rulesT - b.rulesT)[0]?.rulesT ?? seconds * 1000 * 0.4,
      refusalT: refused[0]?.t ?? seconds * 1000 - 1000,
      sentBackT: firstT('plan', 'sent') ?? seconds * 1000 * 0.8,
      splitT: firstT('record', 'rejected') ?? seconds * 1000 - 500,
    },
    facts,
  };
}
const textOf = (p) => (p ? (p.type === 'text' ? p.text : JSON.stringify(p.data ?? '')) : '');
const idFromText = (t) => t?.match?.(/((?:BUG|REQ|ARCH)-\d+)/)?.[1] ?? undefined;

const args = process.argv.slice(2);
let data;
let outName = 'data-backlog.js';
if (args.includes('--out')) outName = args[args.indexOf('--out') + 1];
data = fromRun(args[0]);
const file = path.join(HERE, outName);
fs.writeFileSync(file, `window.COLONY = ${JSON.stringify(data)};\n`);
console.log(`${file}: ${data.facts.bugs}+${data.facts.requirements}+${data.facts.architecture} items, ${data.ledger.length} desk decisions, run ${data.seconds} s`);
