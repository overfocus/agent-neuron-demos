// A second engine process, reached as a peer (agent-neuron decision 0013):
// `peer --listen <addr>` waits for callers, and a run dispatches to it with
// `--peers <file>`. The demos start peers on free ports (listen on
// 127.0.0.1:0, read back the port the engine bound) and kill them whole: a
// peer is a company's own machine in the fiction, so going dark is a process
// group going down, its inside with it.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

/** The peers side file (decision 0013): who to reach, and who hosts what. */
export function writePeers(file, { self, peers, placement }) {
  fs.writeFileSync(file, `${JSON.stringify({ version: 0, self, peers, placement }, null, 2)}\n`);
  return file;
}

/**
 * Start one peer and resolve it once it prints
 * `peer <name>: listening on 127.0.0.1:<port>`. Its stderr is kept at `log`,
 * and each of its lines is offered to `onLine` so a demo can narrate.
 * @param {object} o
 * @param {string} o.engine          the engine binary to run
 * @param {string} o.name            the peer's name (`--name`)
 * @param {string} [o.cwd]           its working directory
 * @param {string[]} [o.args]        after `peer --listen 127.0.0.1:0`
 * @param {string} o.token           the pre-shared token
 * @param {string} o.log             where its stderr lines are kept
 * @param {(line: string) => void} [o.onLine]
 */
export function startPeer(o) {
  const child = spawn(o.engine, ['peer', '--listen', '127.0.0.1:0', ...(o.args ?? []), '--token', o.token, '--name', o.name], {
    detached: true, // its own process group: this peer's whole office, killable as one
    cwd: o.cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const peer = { name: o.name, child, port: null, exited: null };
  peer.kill = () => {
    try {
      process.kill(-child.pid, 'SIGKILL'); // the group: the office and its inside
    } catch {
      // already gone
    }
    try {
      child.kill('SIGKILL');
    } catch {
      // already gone
    }
  };
  peer.done = new Promise((r) =>
    child.on('exit', (code, signal) => {
      peer.exited = code ?? signal;
      r(peer.exited);
    }),
  );
  const log = fs.createWriteStream(o.log);
  let pending = '';
  child.stderr.on('data', (d) => {
    pending += String(d);
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      log.write(`${line}\n`);
      o.onLine?.(line);
      const m = line.match(/listening on [^:\s]+:(\d+)/);
      if (m && peer.port === null) {
        peer.port = Number(m[1]);
        started();
      }
    }
  });
  child.stdout.on('data', () => {}); // the peer prints nothing on stdout, but must not back up
  let started;
  return new Promise((ok, bad) => {
    const timer = setTimeout(() => bad(new Error(`${o.name} never listened`)), 10_000);
    child.on('exit', (code, signal) => {
      if (peer.port === null) {
        clearTimeout(timer);
        bad(new Error(`${o.name} exited (${code}${signal ? ` ${signal}` : ''}) before it listened`));
      }
    });
    started = () => {
      clearTimeout(timer);
      ok(peer);
    };
  });
}
