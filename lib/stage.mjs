// The stage: one page to watch or record a demo from (lib/stage.html), with
// the viewer framed on the left and every person's desk on the right, and
// /current, the manifest the harness writes. 127.0.0.1 only: the desk links
// in the manifest carry each person's token.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { HERE } from './engine.mjs';

export const VIZ_URL = process.env.VIZ_URL ?? 'http://localhost:5180/?attach';

/** Start the stage on `port`; resolves to its URL, or to null if the port is taken. */
export function startStage(port = Number(process.env.STAGE_PORT ?? 5190), viz = VIZ_URL) {
  const page = fs.readFileSync(path.join(HERE, 'lib/stage.html'), 'utf8').replace('@VIZ@', viz.replace(/"/g, '&quot;'));
  const server = http.createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/current') {
      let body = '{}';
      try {
        body = fs.readFileSync(path.join(HERE, 'runs/current.json'), 'utf8');
      } catch {
        // no run yet
      }
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(body);
    }
    if (url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(page);
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => {
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() }));
  });
}

/** Is something answering at `url`? */
export const answering = (url) =>
  fetch(url, { signal: AbortSignal.timeout(1500) })
    .then((r) => r.ok)
    .catch(() => false);
