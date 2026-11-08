// The manager tightens the budget, as a reviewed policy change.
//
//   npm run demo spend                 Sam sets the ceiling on the desk
//   npm run demo spend -- --headless   Sam lowers it to 9
//
// Round 1 runs five research tasks at the file's ceiling (12 credits each).
// The spend report goes to Sam on the desk; Sam keeps the ceiling or lowers
// it. The answer becomes a change to policy.json (a diff someone can review),
// and round 2 runs with the producer lowering every task's pool to it at
// injection (SPEC 10.2: lower, never raise). Not built: lowering a pool of a
// trace that is already running.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer, nextItem } from '../../lib/desk.mjs';
import { runDir } from '../../lib/engine.mjs';
import { deskLine, printTable } from '../../lib/narrate.mjs';
import { startRun } from '../../lib/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const meta = {
  name: 'spend',
  title: 'The manager tightens the budget, as a policy diff',
  about: 'An agent loop spends credits; the manager reads the spend on the desk and lowers the ceiling; round 2 runs under it.',
  variants: [],
};

const TASKS = [
  { task: 'T-1', title: 'Compare two ticket APIs', needs: 2 },
  { task: 'T-2', title: 'Summarise last quarter\'s support tickets', needs: 3 },
  { task: 'T-3', title: 'Survey harbour booking competitors', needs: 3 },
  { task: 'T-4', title: 'Find the cause of the slow search', needs: 6 },
  { task: 'T-5', title: 'Estimate demand for a winter timetable', needs: 9 },
];

/** One round: every task its own trace, with the pool lowered to `cap` when it is below the file's. */
async function round(n, cap, dir, say) {
  const inputs = path.join(dir, `round-${n}.inputs.jsonl`);
  fs.writeFileSync(
    inputs,
    TASKS.map((t, i) => JSON.stringify({ at: i * 300, source: 'tasks', payload: t, ...(cap < 12 && { budget: { credits: cap } }) })).join('\n') + '\n',
  );
  const rdir = path.join(dir, `round-${n}`);
  fs.mkdirSync(rdir, { recursive: true });
  say(`\nRound ${n}: ${TASKS.length} tasks at ${cap} credits each.`);
  const run = startRun({
    name: 'spend',
    title: `${meta.title} - round ${n} at ${cap} credits`,
    dir: rdir,
    network: path.join(HERE, 'spend.network.json'),
    inputs,
  });
  await run.done;
  // Each task's trace: its root signal names the task; its finished event the rest.
  const byTrace = {};
  for (const ev of run.events) {
    if (ev.type === 'signal' && ev.from === 'tasks') byTrace[ev.trace] = { task: ev.payload.data.task, title: ev.payload.data.title };
  }
  const rows = [];
  for (const ev of run.events.filter((e) => e.type === 'finished')) {
    const t = byTrace[ev.trace];
    if (!t) continue;
    const done = run.events.some((e) => e.type === 'answer' && e.from === 'report' && e.trace === ev.trace);
    rows.push({ ...t, spent: cap - (ev.remaining?.credits ?? cap), status: done ? 'done' : ev.status });
  }
  rows.sort((a, b) => a.task.localeCompare(b.task));
  for (const r of rows) say(`  ${r.task} ${r.title.padEnd(42)} ${String(r.spent).padStart(3)} credits  ${r.status}`);
  const total = rows.reduce((s, r) => s + r.spent, 0);
  const wasted = rows.filter((r) => r.status !== 'done').reduce((s, r) => s + r.spent, 0);
  say(`  total ${total} credits; ${rows.filter((r) => r.status === 'done').length} done; ${wasted} spent on tasks that did not finish`);
  return { rows, total, wasted };
}

export async function main({ headless = false, say = console.log } = {}) {
  const dir = runDir('spend');
  const policyFile = path.join(dir, 'policy.json');
  fs.copyFileSync(path.join(HERE, 'policy.json'), policyFile);
  const before = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
  const r1 = await round(1, before.credits_per_task, dir, say);

  // The review: the spend report as one ask on the manager's desk.
  const ask = {
    title: `Round 1 spent ${r1.total} credits; ${r1.wasted} of them on tasks that never finished. Set the ceiling per task.`,
    answerable_by: 'manager',
    notes: r1.rows.map((r) => `${r.task} ${r.title}: ${r.spent} credits, ${r.status}`),
    options: [
      { id: 'keep', label: `Keep ${before.credits_per_task}`, text: String(before.credits_per_task) },
      { id: 'nine', label: 'Lower to 9', text: '9' },
      { id: 'six', label: 'Lower to 6', text: '6' },
    ],
  };
  const rdir = path.join(dir, 'review');
  fs.mkdirSync(rdir, { recursive: true });
  const inputs = path.join(rdir, 'review.inputs.jsonl');
  fs.writeFileSync(inputs, `${JSON.stringify({ at: 0, source: 'spend', payload: ask })}\n`);
  say('\nThe review, on the desk:');
  const review = startRun({
    name: 'spend',
    title: `${meta.title} - the review`,
    dir: rdir,
    network: path.join(HERE, 'review.network.json'),
    inputs,
    grants: path.join(HERE, 'spend.grants.json'),
    peopleCount: 1,
    onDesk: (kind, a) => say(deskLine(review, kind, a)),
  });
  await review.desk;
  printTable(review, say);
  if (headless) {
    const it = await nextItem(review.people.sam.seat);
    if (it) await answer(review.people.sam.seat, { item: it.id, kind: 'choose', option: 'nine', why: 'nothing finished above 9; cap the runaways' });
  }
  await review.done;
  const decided = review.deskAnswers.find((a) => a.kind === 'choose');
  const cap = decided ? Number(decided.text) : before.credits_per_task;
  const after = { ...before, credits_per_task: cap };
  fs.writeFileSync(policyFile, `${JSON.stringify(after)}\n`);
  say('\nThe policy change (a diff to review, not a prompt to trust):');
  say(`  - { "credits_per_task": ${before.credits_per_task} }`);
  say(`  + { "credits_per_task": ${cap} }   # ${review.people.sam?.name ?? 'owner'}${decided?.why ? `: ${decided.why}` : ''}`);

  const r2 = await round(2, cap, dir, say);
  say(`\nRound 1: ${r1.total} credits, ${r1.wasted} wasted. Round 2 at ${cap}: ${r2.total} credits, ${r2.wasted} wasted. The cap turns a runaway task's spend into an earlier refusal; set it below a task's real need and that task stops finishing too.`);
  return { r1, r2, cap, code: 0 };
}
