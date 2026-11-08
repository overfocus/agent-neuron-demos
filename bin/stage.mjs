#!/usr/bin/env node
// npm run stage: one page to record a demo from. The 3D view (agent-neuron-viz
// in attach mode) on the left, each person's own desk page on the right,
// re-pointed at every new run. Open it once, then run demos in a terminal.
//
//   STAGE_PORT (default 5190)  this page's port
//   VIZ_URL (default http://localhost:5180/?attach)  the viewer to frame
//
// It serves two things on 127.0.0.1 only: the page, and /current, the
// manifest the demo harness writes (runs/current.json). The desk links in it
// carry each person's token; they never leave this machine.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openUrl } from '../lib/narrate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.STAGE_PORT ?? 5190);
const VIZ = process.env.VIZ_URL ?? 'http://localhost:5180/?attach';
const PAGE = fs.readFileSync(path.join(ROOT, 'lib/stage.html'), 'utf8').replace('@VIZ@', VIZ.replace(/"/g, '&quot;'));

const server = http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  if (url === '/current') {
    let body = '{}';
    try {
      body = fs.readFileSync(path.join(ROOT, 'runs/current.json'), 'utf8');
    } catch {
      // no run yet
    }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(body);
  }
  if (url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(PAGE);
  }
  res.writeHead(404).end();
});

server.listen(PORT, '127.0.0.1', async () => {
  const stage = `http://127.0.0.1:${PORT}/`;
  console.log(`stage: ${stage}`);
  const vizUp = await fetch(VIZ).then((r) => r.ok).catch(() => false);
  if (!vizUp) console.log(`stage: the viewer is not answering at ${VIZ}: start it with (cd ../agent-neuron-viz && npm run dev)`);
  console.log('stage: now run any demo in another terminal, e.g. npm run demo backlog -- --headless --pace 2');
  if (process.argv.includes('--open')) openUrl(stage);
});
