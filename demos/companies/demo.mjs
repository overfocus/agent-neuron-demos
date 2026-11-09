// Companies: four engines, two company boundaries, one house-rules file.
//
//   npm run demo companies                 Kit answers on the desk
//   npm run demo companies -- --headless   Kit answers with the room dark
//
// The quay office's run holds only its own network file and a peers side file
// (agent-neuron decision 0013): the pilot office's engine hosts its whole team
// graph as one wrapper; their dispatch desk - a second engine of theirs -
// commits the hire, which is our own procedure placed there as an effect; the
// chart room serves one node of the pilot office's graph. Every engine is a
// real process on a free port, reached over the wire. The house rules never
// name a company; the peers file is the whole deployment.
//
// Take one: the hire crosses two boundaries and comes back composed (triaged,
// the chart room's tide, boarded), Kit clears it on our desk. On the second
// vessel the pilot office's dispatch desk goes dark mid-hire - an effect that
// started and does not resolve is unknown: may or may not have happened,
// never guessed, never retried. Their team still answers with their own desk
// dark, our desk holds, and our own ledger kept every arrival.
// Take two: no peers file at all. The same house rules re-run in-house, the
// wrapper is ours to run, both vessels clear.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { play } from '../../lib/desk.mjs';
import { ensureEngine, runDir } from '../../lib/engine.mjs';
import { startPeer, writePeers } from '../../lib/peers.mjs';
import { deskLine } from '../../lib/narrate.mjs';
import { payloadData, payloadText, startRun } from '../../lib/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = '9d30e1a4c7b2f60583a4b5c6d7e8f910'; // pre-shared inside this machine's lab

const readLines = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : []);

export const meta = {
  name: 'companies',
  title: 'Companies: four engines, one workflow, partners that can go dark',
  about:
    'Our quay office, the pilot office (team and dispatch desk) and the chart room each run their own engine. The hire crosses two company boundaries and comes back composed; a partner engine killed mid-hire is unknown; the same house rules rebuild in-house with no peers file at all.',
  variants: [],
};

/** The marks on a composed answer: each office that touched it. */
const marks = (answer) => {
  if (!answer) return [];
  const on = JSON.stringify(answer);
  return ['pilot-office', 'chart', 'boarded'].filter((m) => on.includes(m));
};

export async function main({ headless = false, say = console.log } = {}) {
  const engine = ensureEngine(say);
  const dir = runDir('companies');
  for (const take of ['wire', 'house']) fs.mkdirSync(path.join(dir, take), { recursive: true });

  let charts;
  let desk;
  let pilot;
  try {
    // -- take 1: the partners come online, the run starts, the workflow is
    // -- across two boundaries ----------------------------------------------
    say('The partners come online (each engine its own process, each company its own inside):');

    charts = await startPeer({
      engine,
      name: 'charts',
      cwd: HERE,
      token: TOKEN,
      log: path.join(dir, 'chart-room.log'),
    });
    say(`  the chart room: online at 127.0.0.1:${charts.port} - the pilot office's own supplier, one node of their graph`);

    desk = await startPeer({
      engine,
      name: 'desk',
      cwd: HERE,
      token: TOKEN,
      log: path.join(dir, 'pilot-desk.log'),
    });
    say(`  the pilot office's dispatch desk: online at 127.0.0.1:${desk.port} - the second engine of theirs, the one that commits the hire`);

    const pilotPeers = writePeers(path.join(dir, 'peers.pilot.json'), {
      self: 'pilot',
      peers: [{ name: 'charts', address: `127.0.0.1:${charts.port}`, token: TOKEN }],
      placement: { chart: 'charts' },
    });
    pilot = await startPeer({
      engine,
      name: 'pilot',
      cwd: HERE,
      args: ['--network', path.join(HERE, 'pilot.network.json'), '--peers', pilotPeers],
      token: TOKEN,
      log: path.join(dir, 'pilot-office.log'),
    });
    say(`  the pilot office: online at 127.0.0.1:${pilot.port} - its whole team (triage, chart, board) is one wrapper to us`);

    const ourPeers = writePeers(path.join(dir, 'peers.ours.json'), {
      self: 'quay',
      peers: [
        { name: 'pilot', address: `127.0.0.1:${pilot.port}`, token: TOKEN },
        { name: 'desk', address: `127.0.0.1:${desk.port}`, token: TOKEN },
      ],
      placement: { pilotage: 'pilot', engage: 'desk' },
    });
    say('  our run: the house rules never name a company - the peers side file is the whole deployment');
    say('');

    let dark = false;
    const goDark = (why) => {
      if (dark) return;
      dark = true;
      say(`  ${why} (killed as one machine: the engine and whatever it held)`);
      desk.kill();
    };

    const wire = startRun({
      name: 'companies',
      title: 'Companies: the workflow across two company boundaries',
      dir: path.join(dir, 'wire'),
      network: path.join(HERE, 'companies.network.json'),
      inputs: path.join(HERE, 'companies.inputs.jsonl'),
      grants: path.join(HERE, 'companies.grants.json'),
      peers: ourPeers,
      peopleCount: 1,
      env: { DEMO_DIR: path.join(dir, 'wire') },
      onDesk: (kind, a) => say(deskLine(wire, kind, a)),
      onEvent: (ev) => {
        const from = ev.from ?? ev.neuron ?? '';
        const d = ev.payload?.data ?? {};
        if (ev.type === 'signal' && from === 'arrival') {
          say(`arrival ${d.vessel} (draft ${d.draft} m, ${d.cargo}, window at ${d.due})`);
          say('  our desk files it, wherever the hire goes; the hire crosses the boundary');
          // Safety only: the exact trigger below is the one that fires.
          if (d.vessel === 'ARR-2') setTimeout(() => goDark('the pilot office goes dark mid-hire'), 2500);
        }
        // The exact trigger: the hire's dispatch is the event that names engage.
        if (ev.type === 'signal' && (ev.to ?? []).includes('engage') && d.vessel === 'ARR-2') {
          setTimeout(() => goDark("the pilot office's dispatch desk goes dark mid-hire"), 300);
        }
        if (ev.type === 'unknown') say('  the outcome lands: unknown - the hire may or may not have happened; never guessed, never retried');
        if (ev.type === 'answer' && from === 'engage' && !dark) say(`  the hire is committed on their desk (${d.vessel ?? 'the vessel'} engaged)`);
        if (ev.type === 'answer' && from === 'pilotage') {
          if (dark) say('  their team answers anyway - with their own desk dark, the boundary held');
          else say(`  their answer comes back composed (${marks(payloadData(ev)).join(', ')})`);
        }
        if (ev.type === 'quiet' && from === 'act') say('  no clearance follows: the vessel whose hire went unknown was held');
        if (ev.type === 'answer' && from === 'act') say(`act: ${payloadText(ev)}`);
      },
    });

    await wire.desk;
    if (headless) {
      play(
        wire.people.kit.seat,
        (it) =>
          it.payload.title.includes('ARR-1')
            ? { kind: 'choose', option: 'clear', why: 'the tide window holds; the pilot office brought every mark' }
            : { kind: 'choose', option: 'hold', why: 'the hire came back unknown; never clear on an unknown' },
        () => wire.exited,
      );
    }

    await wire.done;
    const wireCode = (await wire.done)?.code ?? 1;
    const unknowns = fs.readFileSync(path.join(dir, 'wire', 'trace.json'), 'utf8').includes('"type":"unknown"');
    const wireAnswers = wire.events.filter((e) => e.type === 'answer' && e.from === 'pilotage').map((e) => payloadData(e));
    const wireActions = readLines(path.join(dir, 'wire', 'actions.log'));
    const wireJournal = readLines(path.join(dir, 'wire', 'journal.log'));
    say(`  our ledger stands: ${wireJournal.length} arrivals filed at our desk, whatever the border did`);
    say('');

    // -- take 2: the same house rules, in-house -------------------------------
    say('Take two: the same house rules, no peers file at all - the wrapper is ours to run.');
    const house = startRun({
      name: 'companies',
      title: 'Companies: the same house rules, in-house',
      dir: path.join(dir, 'house'),
      network: path.join(HERE, 'companies.network.json'),
      inputs: path.join(HERE, 'companies.inputs.jsonl'),
      grants: path.join(HERE, 'companies.grants.json'),
      peopleCount: 1,
      env: { DEMO_DIR: path.join(dir, 'house') },
      onDesk: (kind, a) => say(deskLine(house, kind, a)),
      onEvent: (ev) => {
        if (ev.type === 'answer' && ev.from === 'act') say(`act: ${payloadText(ev)}`);
      },
    });
    await house.desk;
    if (headless) {
      play(house.people.kit.seat, () => ({ kind: 'choose', option: 'clear', why: 'same rules, now inside our walls' }), () => house.exited);
    }
    await house.done;
    const houseCode = (await house.done)?.code ?? 1;
    const houseActions = readLines(path.join(dir, 'house', 'actions.log'));
    const houseAnswers = house.events.filter((e) => e.type === 'answer' && e.from === 'pilotage').map((e) => payloadData(e));

    // -- report -----------------------------------------------------------------
    say('');
    say(`take 1: the composed answer carries every mark: ${marks(wireAnswers[0]).join(', ') || 'none came back'}`);
    say(`        ${wireActions.length} clearance(s): ${wireActions.join('; ') || 'none'}`);
    say(`        journal: ${wireJournal.length} arrivals filed; unknown: ${unknowns ? "yes - ARR-2's hire" : 'no'}`);
    say(`take 2: ${houseActions.length} clearance(s): ${houseActions.join('; ') || 'none'}; composed marks: ${marks(houseAnswers.at(-1)).join(', ')}`);
    say(`files:  ${dir} (peers files, both traces, the partners' own logs)`);

    const code = wireCode === 0 && houseCode === 0 ? 0 : 1;
    say('');
    say(`Done: a workflow built across two company boundaries, torn down mid-hire, rebuilt in-house - the house rules file never changed.`);
    return {
      code,
      ports: { pilot: pilot.port, desk: desk.port, charts: charts.port },
      wire: { answer: wireAnswers[0], answer2: wireAnswers[1], actions: wireActions, journal: wireJournal, unknowns, desk: wire.deskAnswers, code: wireCode },
      house: { answer: houseAnswers.at(-1), actions: houseActions, code: houseCode },
    };
  } finally {
    for (const p of [pilot, desk, charts]) {
      if (p) p.kill();
    }
    for (const p of [pilot, desk, charts]) {
      if (p) await p.done;
    }
  }
}
