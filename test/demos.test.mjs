// Every demo, run headless against the real engine, with the outcome it
// promises asserted. Needs the agent-neuron checkout next to this repo (or
// AGENT_NEURON_ROOT); the engine is built when missing.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const quiet = () => {};
const run = async (name, opts = {}) => (await import(`../demos/${name}/demo.mjs`)).main({ say: quiet, headless: true, ...opts });

test('quorum: agreement merges the agreed branch; Lin is refused on the lead gate', async () => {
  const r = await run('quorum');
  assert.deepEqual(r.merged, ['agent/patch-a']);
  assert.deepEqual(r.answers.map((a) => a.by), ['ada', 'lin', 'sam']);
  assert.equal(r.refusals.length, 1);
  assert.equal(r.refusals[0].by, 'lin');
});

test('quorum --tie: a split goes to the lead, whose No merges nothing', async () => {
  const r = await run('quorum', { flags: ['--tie'] });
  assert.deepEqual(r.merged, []);
  assert.equal(r.answers.at(-1).kind, 'no');
});

test('backlog: the house rules route the work; every decision has who and why', async () => {
  const r = await run('backlog');
  assert.equal(r.bugs.landedAuto.length, 10);
  assert.deepEqual(r.bugs.flagged.sort(), ['BUG-04', 'BUG-09', 'BUG-12', 'BUG-13']);
  assert.deepEqual(r.bugs.landedByLead, ['BUG-04']);
  assert.equal(r.bugs.refusedByBudget, 1);
  assert.equal(r.requirements.filter((p) => p.startsWith('scheduled')).length, 4);
  assert.deepEqual(r.architecture.sort(), ['ARCH-1 adopted', 'ARCH-2 rejected']);
  assert.equal(r.decisions, 20);
  assert.ok(r.answers.every((a) => a.by));
});

test('spend: the lowered ceiling spends less and finishes the same tasks', async () => {
  const r = await run('spend');
  assert.equal(r.cap, 9);
  const done = (x) => x.rows.filter((row) => row.status === 'done').map((row) => row.task);
  assert.deepEqual(done(r.r2), done(r.r1));
  assert.ok(r.r2.total < r.r1.total);
  assert.ok(r.r2.rows.every((row) => row.spent <= 9));
});

test('refunds: each refund paid once, the stale answer held back, the unknown reconciled', async () => {
  const r = await run('refunds');
  const ids = r.ledger.map((p) => p.id).sort();
  assert.deepEqual(ids, ['R-1', 'R-2', 'R-3', 'R-5', 'R-6', 'R-7']);
  assert.equal(r.held, 1);
  assert.deepEqual(r.unknowns, ['R-6']);
  assert.match(r.findings[0], /R-6 WAS paid/);
  assert.equal(r.receipts, 5);
});

test('oncall: the stale ask is withdrawn and its late answer refused', async () => {
  const r = await run('oncall');
  assert.equal(r.late, 410);
  assert.deepEqual(r.actions, ['payments: roll back deploy 2026.11.08-3']);
});

test('colony: ants forage without a scheduler, and the eager ones do more of it', async () => {
  const r = await run('colony', { flags: ['--ants', '12', '--seconds', '15'] });
  assert.equal(r.code, 0);
  assert.ok(r.deliveries.length > 10, `only ${r.deliveries.length} deliveries`);
  assert.ok(r.eager > r.reluctant, `eager ${r.eager} vs reluctant ${r.reluctant}`);
  // Loose assertions that hold under the default seed 11. The ants and the
  // food run on live Math.random (never seeded), so nothing counts arrivals:
  // only what the seed pins - the drop schedule - and what the demo promises.
  assert.equal(r.seed, 11);
  assert.ok(r.drops.length >= 1, 'no drop site in the schedule');
  assert.ok(r.drops.every((d) => d.appear >= 0.3 * 15 && d.appear <= 0.8 * 15), `a drop outside the appear window: ${JSON.stringify(r.drops)}`);
  assert.ok(Array.isArray(r.empties) && r.empties.every((e) => typeof e.food === 'string'), 'empties not shaped');
  // The ground the engine keeps: the nest's drumbeat writes the trail per
  // arrival, the settle beat reports, and the drops arrive on schedule.
  assert.ok(r.groundWrites >= 10, `only ${r.groundWrites} ground writes`);
  assert.ok(r.drops.some((d) => d.id.startsWith('drop-')), 'no drop in the schedule');
  assert.ok('wasted' in r && Array.isArray(r.empties), 'the dry report is missing');
});
