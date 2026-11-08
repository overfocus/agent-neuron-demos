// Shared by the backlog neurons: read the one JSON input, write one answer
// (or nothing, which is quiet), and find the demo's data and run folder.
import fs from 'node:fs';

export async function input() {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  return JSON.parse(raw);
}
export const answer = (v) => process.stdout.write(JSON.stringify(v));
export const data = () => JSON.parse(fs.readFileSync(process.env.DEMO_DATA, 'utf8'));
export const rules = () => JSON.parse(fs.readFileSync(process.env.HOUSE_RULES, 'utf8'));
export const runDir = () => process.env.DEMO_DIR;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** A stable latency from an id, so a run looks alike each time. */
export const latency = (id, lo, hi) => lo + ([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % (hi - lo));
