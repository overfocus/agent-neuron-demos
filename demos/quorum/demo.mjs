// Quorum and the lead's gate: which agent patch lands.
//
//   npm run demo quorum                 people answer on their desk pages
//   npm run demo quorum -- --headless   Ada and Lin both choose patch-a, Sam merges
//   npm run demo quorum -- --headless --tie   Lin chooses patch-b, Sam says no
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer, nextItem, pause } from '../../lib/desk.mjs';
import { runDir } from '../../lib/engine.mjs';
import { deskLine, printTable } from '../../lib/narrate.mjs';
import { payloadText, startRun } from '../../lib/run.mjs';
import { BRANCHES, prepareRepo } from './prepare.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const meta = {
  name: 'quorum',
  title: 'Quorum and the gate: which agent patch lands',
  about: 'Two reviewers choose between two real agent branches; a threshold-2 join hears both; the lead gates a real git merge (an effect).',
  variants: ['--tie'],
};

export async function main({ headless = false, flags = [], say = console.log } = {}) {
  const tie = flags.includes('--tie');
  const dir = runDir('quorum');
  const repo = path.join(dir, 'repo');
  say('The scratch repo, before:');
  say(prepareRepo(repo));

  const run = startRun({
    name: 'quorum',
    title: meta.title,
    dir,
    network: path.join(HERE, 'quorum.network.json'),
    inputs: path.join(HERE, 'quorum.inputs.jsonl'),
    grants: path.join(HERE, 'quorum.grants.json'),
    peopleCount: 3,
    env: { DEMO_REPO: repo },
    onDesk: (kind, a) => say(deskLine(run, kind, a)),
    onEvent: (ev) => {
      if (ev.type === 'answer' && ev.from === 'tally') say('quorum: both reviewers are in; the lead has the gate');
      if (ev.type === 'answer' && ev.from === 'merge') say(`merge: ${payloadText(ev)}`);
      if (ev.type === 'unknown') say(`merge: UNKNOWN (${ev.message}) - check the repo before trying again`);
      if (ev.type === 'drop' && ev.reason === 'expired') say(`${ev.neuron}: a vote waited too long and expired`);
    },
  });
  await run.desk;
  printTable(run, say);

  if (headless) {
    const { ada, lin, sam } = run.people;
    const choose = async (who, option, why) => {
      const it = await nextItem(who.seat);
      await pause();
      if (it) await answer(who.seat, { item: it.id, kind: 'choose', option, why });
    };
    await choose(ada, 'a', 'the tide is the real constraint');
    // Lin tries the lead's gate first: the desk refuses it (not granted).
    await choose(lin, tie ? 'b' : 'a', tie ? 'a fixed time is easier to publish' : 'agreed, and it changes less');
    const gate = await nextItem(sam.seat, (i) => i.neuron === 'lead');
    if (gate) {
      await pause();
      const bad = await answer(lin.seat, { item: gate.id, kind: 'no' });
      say(`(Lin tried to answer the lead's gate: ${bad.status} ${bad.json?.error ?? ''})`);
      await pause();
      if (tie) await answer(sam.seat, { item: gate.id, kind: 'no', why: 'no consensus; both back to the agents' });
      else await answer(sam.seat, { item: gate.id, kind: 'choose', option: gate.payload.options[0].id, why: 'reviewed the diff' });
    }
  }

  await run.done;
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
  const merged = BRANCHES.filter((b) => git('branch', '--merged', 'main', '--list', b));
  say('');
  say('The scratch repo, after:');
  say(git('log', '--oneline', '--graph', '--all', '--decorate', '-8'));
  say('');
  say(merged.length ? `Landed: ${merged.join(', ')}` : 'Landed: nothing');
  say(`Decided by: ${run.deskAnswers.map((a) => run.people[a.by]?.name ?? a.by).join(', ')}; refused: ${run.refusals.length}`);
  say(`Trace: ${run.files.trace}`);
  return { merged, answers: run.deskAnswers, refusals: run.refusals, events: run.events, code: (await run.done).code };
}
