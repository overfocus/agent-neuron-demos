// The hire: our own procedure, placed by the peers file onto the pilot
// office's engine, there committed. The boarding takes a while. If the office
// goes dark before it answers, nobody gets to say it did not happen: the
// outcome is unknown, on both desks never the less.
import readline from 'node:readline';

let raw = '';
for await (const c of process.stdin) raw += c;
const a = JSON.parse(raw);
await new Promise((r) => setTimeout(r, 3000));
process.stdout.write(JSON.stringify({ hired: true, vessel: a.vessel, office: 'pilot-office' }));
