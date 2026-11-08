// On-call: a decision that goes stale before it is made.
//
//   npm run demo oncall                 Kit answers on the desk (try the payments item after 4 s)
//   npm run demo oncall -- --headless   Kit is still reading the first payments ask when it is withdrawn
//
// The first payments alert asks Kit to restart the API. Four seconds later a
// newer alert for the same service says the cause is a deploy: the engine
// cuts the stale ask (5.4), the desk withdraws its item, Kit's answer to it
// is refused, and the new ask (roll back) takes its place.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer, nextItem, pause, play } from '../../lib/desk.mjs';
import { runDir } from '../../lib/engine.mjs';
import { deskLine, printTable } from '../../lib/narrate.mjs';
import { payloadText, startRun } from '../../lib/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const meta = {
  name: 'oncall',
  title: 'On-call: a decision that goes stale before it is made',
  about: 'A newer alert for the same service withdraws the waiting ask; an answer to it is refused; the new ask replaces it.',
  variants: [],
};

export async function main({ headless = false, say = console.log } = {}) {
  const dir = runDir('oncall');
  const run = startRun({
    name: 'oncall',
    title: meta.title,
    dir,
    network: path.join(HERE, 'oncall.network.json'),
    inputs: path.join(HERE, 'oncall.inputs.jsonl'),
    grants: path.join(HERE, 'oncall.grants.json'),
    peopleCount: 1,
    env: { DEMO_DIR: dir },
    onDesk: (kind, a) => say(deskLine(run, kind, a)),
    onEvent: (ev) => {
      if (ev.type === 'signal' && ev.from === 'alerts') say(`alert: ${ev.payload.data.service} - ${ev.payload.data.alert}`);
      if (ev.type === 'drop' && ev.neuron === 'oncall') say(`desk: the ask at oncall is withdrawn (${ev.reason}, ${ev.phase}): a newer alert replaced it`);
      if (ev.type === 'answer' && ev.from === 'act') say(`act: ${payloadText(ev)}`);
    },
  });
  await run.desk;
  printTable(run, say);
  let late = null;
  if (headless) {
    const seat = run.people.kit.seat;
    const first = await nextItem(seat, (i) => i.payload.title.startsWith('payments'));
    say(`(Kit opens "${first.payload.title}" and starts reading the dashboards...)`);
    // Kit reads until the newer payments ask is on the desk.
    await nextItem(seat, (i) => i.id !== first.id && i.payload.title.startsWith('payments'));
    await pause();
    late = await answer(seat, { item: first.id, kind: 'choose', option: 'do', why: 'latency, restart it' });
    say(`(Kit answers the first payments ask anyway: ${late.status} ${late.json?.error ?? ''})`);
    await play(
      seat,
      (it) => {
        const search = it.payload.title.startsWith('search');
        return { kind: 'choose', option: search ? 'hold' : 'do', why: search ? 'cleanup at 04:00 frees it' : 'errors started with the deploy' };
      },
      () => run.exited,
    );
  }
  await run.done;
  const actions = fs.existsSync(path.join(dir, 'actions.log')) ? fs.readFileSync(path.join(dir, 'actions.log'), 'utf8').trim().split('\n') : [];
  say('');
  say(`Done: ${actions.join('; ') || 'nothing'}. The restart was never run: the ask it answered no longer existed.`);
  return { actions, late: late?.status ?? null, answers: run.deskAnswers, code: 0 };
}
