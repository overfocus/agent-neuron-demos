// Files the arrival in our own ledger. An effect, on our side of the border:
// it runs whatever happens next across the boundary - even on an arrival whose
// hire came back unknown.
import fs from 'node:fs';
import readline from 'node:readline';

readline.createInterface({ input: process.stdin }).once('line', (raw) => {
  const a = JSON.parse(raw);
  fs.appendFileSync(`${process.env.DEMO_DIR}/journal.log`, `filed ${a.vessel} (draft ${a.draft} m, ${a.cargo}) at our desk\n`);
  process.stdout.write(JSON.stringify({ ...a, journaled: true }));
});
