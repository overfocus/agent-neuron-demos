// One engine run, the way every demo here starts one: the command line with a
// trace, a live stream and (when the demo has people) grants. The harness reads
// the desk's stderr lines (the owner's address, one per person, every accepted
// answer and every refusal), tails the stream so a demo can narrate events as
// they land, and keeps runs/current.json up to date, so a viewer
// (agent-neuron-viz in attach mode) can follow whichever demo runs.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { seat } from './desk.mjs';
import { ensureEngine, RUNS } from './engine.mjs';

/**
 * @param {object} o
 * @param {string} o.name      the demo's name (runs/<name>/)
 * @param {string} o.title     a line for the viewer
 * @param {string} o.dir       the run folder (from runDir)
 * @param {string} o.network   the network file
 * @param {string} o.inputs    the inputs file
 * @param {string} [o.grants]  the grants file
 * @param {string} [o.cwd]     the engine's working directory (default: the network's folder)
 * @param {object} [o.env]     extra environment for the engine (and so for neurons that name it in `env`)
 * @param {(ev: object) => void} [o.onEvent]   each stream event, as it lands
 * @param {(line: string) => void} [o.onLog]   each stderr line that is not the desk's
 * @param {(kind: 'answer'|'refused', line: object) => void} [o.onDesk]  each desk answer or refusal
 * @param {string[]} [o.walk]  neurons a viewer should draw walking between the places their file gives them (`at`)
 * @param {number} [o.peopleCount]  how many people the grants name (the desk is ready when all are announced)
 */
export function startRun(o) {
  const engine = ensureEngine();
  const files = {
    stream: path.join(o.dir, 'stream.jsonl'),
    trace: path.join(o.dir, 'trace.json'),
    stderr: path.join(o.dir, 'stderr.log'),
  };
  const args = ['run', path.resolve(o.network), '--inputs', path.resolve(o.inputs), '--trace', files.trace, '--stream', files.stream];
  if (o.grants) args.push('--grants', path.resolve(o.grants));
  const child = spawn(engine, args, {
    cwd: o.cwd ?? path.dirname(path.resolve(o.network)),
    env: { ...process.env, ...(o.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const run = {
    files,
    child,
    owner: null,
    people: {},
    deskAnswers: [],
    refusals: [],
    events: [],
    stdout: [],
    started: Date.now(),
  };

  const manifest = {
    demo: o.name,
    title: o.title,
    network: path.resolve(o.network),
    stream: files.stream,
    trace: files.trace,
    started: run.started,
    ended: false,
    people: [],
    ...(o.walk?.length && { walk: o.walk }),
  };
  fs.mkdirSync(RUNS, { recursive: true });
  const writeManifest = () => {
    const tmp = path.join(RUNS, `.current.${process.pid}.json`);
    fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
    fs.renameSync(tmp, path.join(RUNS, 'current.json'));
  };
  writeManifest();

  const log = fs.createWriteStream(files.stderr);
  let deskReady;
  run.desk = new Promise((r) => (deskReady = r));
  readline.createInterface({ input: child.stderr }).on('line', (line) => {
    log.write(`${line}\n`);
    if (line.startsWith('desk: ')) {
      run.owner = seat(line.slice(6).trim());
      if (!o.grants) deskReady(run);
    } else if (line.startsWith('desk person: ')) {
      const p = JSON.parse(line.slice(13));
      run.people[p.id] = { ...p, seat: seat(p.url) };
      manifest.people.push({ id: p.id, name: p.name, roles: p.roles, url: p.url });
      writeManifest();
      if (manifest.people.length === (o.peopleCount ?? Infinity)) deskReady(run);
    } else if (line.startsWith('desk answer: ')) {
      const a = JSON.parse(line.slice(13));
      run.deskAnswers.push(a);
      o.onDesk?.('answer', a);
    } else if (line.startsWith('desk refused: ')) {
      const r = JSON.parse(line.slice(14));
      run.refusals.push(r);
      o.onDesk?.('refused', r);
    } else {
      o.onLog?.(line);
    }
  });
  readline.createInterface({ input: child.stdout }).on('line', (l) => run.stdout.push(l));

  // The stream, tailed: a file the engine appends one JSON line per event to.
  let pos = 0;
  let buf = '';
  const drain = () => {
    let size = 0;
    try {
      size = fs.statSync(files.stream).size;
    } catch {
      return;
    }
    if (size <= pos) return;
    const fd = fs.openSync(files.stream, 'r');
    const chunk = Buffer.alloc(size - pos);
    fs.readSync(fd, chunk, 0, chunk.length, pos);
    fs.closeSync(fd);
    pos = size;
    buf += chunk.toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const l of lines) {
      if (!l.trim()) continue;
      const ev = JSON.parse(l);
      run.events.push(ev);
      o.onEvent?.(ev);
    }
  };
  const tail = setInterval(drain, 100);

  run.done = new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      run.exited = true;
      // stderr and the stream settle after the exit: read them out first.
      setTimeout(() => {
        clearInterval(tail);
        drain();
        log.end();
        manifest.ended = true;
        manifest.code = code;
        writeManifest();
        deskReady(run); // a run that never opened its desk still resolves
        resolve({ code, signal });
      }, 150);
    });
  });
  run.stop = () => child.kill('SIGTERM');
  return run;
}

/** Text of an event's payload: the text itself, or compact JSON. */
export function payloadText(ev) {
  const p = ev?.payload;
  if (!p) return '';
  if (p.type === 'text') return p.text;
  return p.preview ?? JSON.stringify(p.data);
}

/** The JSON value of an event's payload, when it is one. */
export function payloadData(ev) {
  const p = ev?.payload;
  if (p?.type === 'json') return p.data;
  if (p?.type === 'text') {
    try {
      return JSON.parse(p.text);
    } catch {
      return p.text;
    }
  }
  return undefined;
}
