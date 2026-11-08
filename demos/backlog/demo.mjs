// The backlog: 15 bugs, 5 requirements, 2 architecture changes, a team of
// three, and agents doing the work. What reaches a person is decided by the
// house rules (a data file); everything a person decides is on the desk's
// record, with who and why.
//
//   npm run demo backlog                 Ada, Lin and Sam answer on their pages
//   npm run demo backlog -- --headless   they answer as backlog.data.json's headless section says
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer, state } from '../../lib/desk.mjs';
import { runDir } from '../../lib/engine.mjs';
import { deskLine, printTable } from '../../lib/narrate.mjs';
import { payloadText, startRun } from '../../lib/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'backlog.data.json');

export const meta = {
  name: 'backlog',
  title: 'The backlog: 15 bugs, 5 requirements, 2 architecture changes',
  about: 'Agents do the work; the house rules decide what needs a person; the desk records who decided and why.',
  variants: [],
};

/** The inputs: every item its own trace, staggered so the flow can be watched. */
function writeInputs(file, data) {
  const lines = [];
  data.bugs.forEach((b, i) => {
    const e = { at: 200 + i * 250, source: 'bugs', replaces: b.id, payload: { id: b.id, title: b.title, severity: b.severity } };
    if (b.budget) e.budget = b.budget;
    lines.push(e);
  });
  data.requirements.forEach((r, i) => lines.push({ at: 600 + i * 700, source: 'requirements', replaces: r.id, payload: { id: r.id, title: r.title } }));
  data.architecture.forEach((a, i) => lines.push({ at: 1500 + i * 1500, source: 'architecture', replaces: a.id, payload: { id: a.id, title: a.title } }));
  lines.sort((a, b) => a.at - b.at);
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

const idOf = (item) => item.payload?.title?.match(/^((?:BUG|REQ|ARCH)-\d+)/)?.[1];

/** One invented person answering their own items by the data's headless section. */
async function play(run, who, policy, say) {
  const seat = run.people[who].seat;
  const done = new Set();
  for (;;) {
    const s = await state(seat);
    if (!s || s.over) return;
    const it = s.items.find((i) => i.status === 'waiting' && i.yours && !done.has(i.id));
    if (!it) {
      await new Promise((r) => setTimeout(r, 120));
      continue;
    }
    done.add(it.id);
    const id = idOf(it);
    let pick = { choose: 'accept' };
    if (it.neuron === 'lead-bugs') pick = policy.bugs[id] ?? { choose: 'rework' };
    else if (it.neuron === 'lead-arch') pick = policy.architecture[id]?.sam ?? { choose: 'reject' };
    else if (it.neuron.endsWith('-req')) pick = policy.requirements[id]?.[who] ?? { choose: 'accept' };
    else if (it.neuron.endsWith('-arch')) {
      const p = policy.architecture[id]?.[who];
      pick = typeof p === 'string' ? { choose: p } : (p ?? { choose: 'accept' });
    }
    await new Promise((r) => setTimeout(r, 250)); // a person reads before answering
    const r = await answer(seat, { item: it.id, kind: 'choose', option: pick.choose, why: pick.why });
    if (r.status !== 200) say(`(${who} could not answer ${it.id}: ${r.json?.error ?? r.status})`);
  }
}

export async function main({ headless = false, say = console.log } = {}) {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const dir = runDir('backlog');
  const inputs = path.join(dir, 'backlog.inputs.jsonl');
  writeInputs(inputs, data);
  say(`${data.bugs.length} bugs, ${data.requirements.length} requirements, ${data.architecture.length} architecture changes, for Ada, Lin (ICs) and Sam (lead).`);

  const run = startRun({
    name: 'backlog',
    title: meta.title,
    dir,
    network: path.join(HERE, 'backlog.network.json'),
    inputs,
    grants: path.join(HERE, 'backlog.grants.json'),
    peopleCount: 3,
    env: { DEMO_DATA: DATA, HOUSE_RULES: path.join(HERE, 'house-rules.json'), DEMO_DIR: dir },
    onDesk: (kind, a) => say(deskLine(run, kind, a)),
    onEvent: (ev) => {
      if (ev.type === 'answer' && ev.from === 'rules') {
        const d = ev.payload?.data;
        if (d && d.verdict !== 'clean') say(`rules: ${d.id} is ${d.verdict === 'slop' ? 'slop' : 'a lock-in'} - to the lead`);
      }
      if (ev.type === 'answer' && ['land', 'plan', 'record'].includes(ev.from)) say(`${ev.from}: ${payloadText(ev)}`);
      if (ev.type === 'error' && ev.code === 'budget') say(`budget: ${ev.payload?.data?.id ?? ''} refused at ${ev.neuron} - ${ev.message}`);
      if (ev.type === 'unknown') say(`UNKNOWN at ${ev.neuron}: ${ev.message}`);
    },
  });
  await run.desk;
  printTable(run, say);
  if (headless) await Promise.all(['ada', 'lin', 'sam'].map((w) => play(run, w, data.headless, say)));
  const { code } = await run.done;

  const landed = fs.existsSync(path.join(dir, 'landed.jsonl'))
    ? fs.readFileSync(path.join(dir, 'landed.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const flagged = run.events.filter((e) => e.type === 'answer' && e.from === 'rules' && e.payload?.data?.verdict !== 'clean').map((e) => e.payload.data.id);
  const refused = run.events.filter((e) => e.type === 'error' && e.code === 'budget');
  const plans = run.events.filter((e) => e.type === 'answer' && e.from === 'plan').map(payloadText);
  const records = run.events.filter((e) => e.type === 'answer' && e.from === 'record').map(payloadText);
  const summary = {
    bugs: {
      landedAuto: landed.filter((l) => l.how === 'auto').map((l) => l.id),
      landedByLead: landed.filter((l) => l.how === 'lead').map((l) => l.id),
      flagged,
      refusedByBudget: refused.length,
    },
    requirements: plans,
    architecture: records,
    decisions: run.deskAnswers.length,
    refusals: run.refusals.length,
  };
  say('');
  say(`Bugs: ${summary.bugs.landedAuto.length} landed on their own; ${flagged.length} flagged by the house rules (${flagged.join(', ')}), of which the lead let ${summary.bugs.landedByLead.length} through; ${refused.length} refused by its budget.`);
  say(`Requirements: ${plans.join('; ') || 'none decided'}`);
  say(`Architecture: ${records.join('; ') || 'none decided'}`);
  say(`${run.deskAnswers.length} decisions on the desk, by ${[...new Set(run.deskAnswers.map((a) => run.people[a.by]?.name ?? a.by))].join(', ')}. Records in ${path.join(dir, 'adr')}.`);
  say(`Trace: ${run.files.trace}`);
  return { ...summary, code, events: run.events, answers: run.deskAnswers };
}
