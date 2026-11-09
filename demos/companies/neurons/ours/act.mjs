// Carries out the harbourmaster's call: an effect (never cut). "hold" does
// nothing. The option's text is the whole clearance, composed back at our desk
// with the pilot office's marks on it. Unknown is not ours to guess: nothing
// arrives here for it.
import fs from 'node:fs';

let raw = '';
for await (const c of process.stdin) raw += c;
const t = String(JSON.parse(raw)).trim();
if (!t.startsWith('clear ')) process.exit(0);
await new Promise((r) => setTimeout(r, 300));
const what = t.slice(6);
fs.appendFileSync(`${process.env.DEMO_DIR}/actions.log`, `${what}\n`);
process.stdout.write(JSON.stringify(`cleared: ${what}`));
