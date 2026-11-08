// Refunds: an irreversible action, a person over the limit, and what the
// engine does when nobody can say whether the money moved.
//
//   npm run demo refunds                 Sam decides the large refunds on the desk
//   npm run demo refunds -- --headless   Sam pays R-3 and R-6, denies R-4
//
// Watch for three things: a resubmitted request (R-2) arriving while the
// first payment is running - the payment is not cut, its forward is held
// back, and the second call finds the refund already claimed; a payment
// (R-6) whose connection drops after the money moved - recorded `unknown`,
// not as an error; and the reconcile run that asks the ledger what happened.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { play } from '../../lib/desk.mjs';
import { runDir } from '../../lib/engine.mjs';
import { deskLine, printTable } from '../../lib/narrate.mjs';
import { payloadText, startRun } from '../../lib/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'refunds.data.json');

export const meta = {
  name: 'refunds',
  title: 'Refunds: an effect that needs a person, and an unknown',
  about: 'Large refunds wait for a person; paying is never cut; a crash after the money moved is unknown, and a reconcile run finds out.',
  variants: [],
};

export async function main({ headless = false, say = console.log } = {}) {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const dir = runDir('refunds');
  const inputs = path.join(dir, 'refunds.inputs.jsonl');
  const lines = data.requests.map((r, i) => ({ at: i * 600, source: 'requests', replaces: r.id, payload: { id: r.id } }));
  // R-2 is sent again while its first payment runs: the same key.
  lines.push({ at: 1700, source: 'requests', replaces: 'R-2', payload: { id: 'R-2', resubmitted: true } });
  lines.sort((a, b) => a.at - b.at);
  fs.writeFileSync(inputs, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  say(`${data.requests.length} refund requests; refunds over ${data.limit} need Sam. R-2 is resubmitted while it is being paid.`);

  const env = { REFUND_DATA: DATA, DEMO_DIR: dir };
  const run = startRun({
    name: 'refunds',
    title: meta.title,
    dir,
    network: path.join(HERE, 'refunds.network.json'),
    inputs,
    grants: path.join(HERE, 'refunds.grants.json'),
    peopleCount: 1,
    env,
    onDesk: (kind, a) => say(deskLine(run, kind, a)),
    onEvent: (ev) => {
      if (ev.type === 'answer' && ev.from === 'pay') say(`pay: ${payloadText(ev)}${ev.forwarded === false ? '  [stale: answer recorded, not forwarded - no second receipt]' : ''}`);
      if (ev.type === 'answer' && ev.from === 'receipt') say(`receipt: ${payloadText(ev).replace('receipt sent: ', '')}`);
      if (ev.type === 'unknown') say(`pay: UNKNOWN for ${payloadText(ev).match(/R-\d+/)?.[0] ?? '?'} - ${ev.message.split('\n')[0]}`);
      if (ev.type === 'drop' && ev.reason === 'replaced') say(`${ev.neuron}: stale work dropped (${ev.phase ?? ''})`);
    },
  });
  await run.desk;
  printTable(run, say);
  if (headless) {
    await play(
      run.people.sam.seat,
      (it) => {
        const pick = data.headless[it.payload.title.split(':')[0]] ?? { choose: 'deny' };
        return { kind: 'choose', option: pick.choose, why: pick.why };
      },
      () => run.exited,
    );
  }
  await run.done;

  // The observer's part (SPEC 11.4): every unknown is asked about.
  // The id is on the payload: the refund object, or the approver's "pay R-6".
  const unknowns = run.events.filter((e) => e.type === 'unknown').map((e) => payloadText(e).match(/R-\d+/)?.[0]).filter(Boolean);
  const findings = [];
  if (unknowns.length) {
    say(`\nReconciling ${unknowns.join(', ')}: a new run asks the ledger.`);
    const rdir = path.join(dir, 'reconcile');
    fs.mkdirSync(rdir, { recursive: true });
    const rin = path.join(rdir, 'reconcile.inputs.jsonl');
    fs.writeFileSync(rin, unknowns.map((id, i) => JSON.stringify({ at: i * 100, source: 'reconcile', payload: { id } })).join('\n') + '\n');
    const rec = startRun({ name: 'refunds', title: `${meta.title} - reconcile`, dir: rdir, network: path.join(HERE, 'refunds.network.json'), inputs: rin, env });
    await rec.done;
    for (const e of rec.events.filter((x) => x.type === 'answer' && x.from === 'lookup')) {
      findings.push(payloadText(e));
      say(`lookup: ${payloadText(e)}`);
    }
  }
  const ledger = fs.existsSync(path.join(dir, 'paid.jsonl')) ? fs.readFileSync(path.join(dir, 'paid.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  const receipts = run.events.filter((e) => e.type === 'answer' && e.from === 'receipt').length;
  const held = run.events.filter((e) => e.type === 'answer' && e.from === 'pay' && e.forwarded === false).length;
  say('');
  say(`Paid: ${ledger.map((p) => `${p.id} ${p.amount}`).join(', ')} (each once). Receipts: ${receipts}. Stale answers held back: ${held}. Unknown: ${unknowns.length}, reconciled.`);
  return { ledger, receipts, held, unknowns, findings, answers: run.deskAnswers, code: 0 };
}
