// The pilot office's triage clerk: takes the ask, marks it theirs.
import readline from 'node:readline';

readline.createInterface({ input: process.stdin }).once('line', (raw) => {
  const a = JSON.parse(raw);
  process.stdout.write(JSON.stringify({ ...a, triaged: true, office: 'pilot-office' }));
});
