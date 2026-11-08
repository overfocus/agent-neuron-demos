import fs from 'node:fs';
export async function input() {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  return JSON.parse(raw);
}
export const answer = (v) => process.stdout.write(JSON.stringify(v));
export const data = () => JSON.parse(fs.readFileSync(process.env.REFUND_DATA, 'utf8'));
export const ledger = () => `${process.env.DEMO_DIR}/paid.jsonl`;
export const paid = () => (fs.existsSync(ledger()) ? fs.readFileSync(ledger(), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
