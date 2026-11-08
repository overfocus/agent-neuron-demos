// Carries out the on-call person's call: an effect (never cut). "hold" does
// nothing.
import fs from 'node:fs';
let raw = '';
for await (const c of process.stdin) raw += c;
const t = String(JSON.parse(raw)).trim();
if (!t.startsWith('do ')) process.exit(0);
await new Promise((r) => setTimeout(r, 300));
fs.appendFileSync(`${process.env.DEMO_DIR}/actions.log`, `${t.slice(3)}\n`);
process.stdout.write(JSON.stringify(`done: ${t.slice(3)}`));
