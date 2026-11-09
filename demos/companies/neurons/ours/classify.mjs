// Our intake desk: sorts the arrival, hands it on. (Level 1: one line in, one out.)
import readline from 'node:readline';

readline.createInterface({ input: process.stdin }).once('line', (raw) => {
  const a = JSON.parse(raw);
  process.stdout.write(JSON.stringify({ ...a, office: 'quay' }));
});
