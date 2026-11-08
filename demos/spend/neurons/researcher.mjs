// A research agent (canned): each round it adds a finding to the task, and
// the critic's "more" sends it round again.
let raw = '';
for await (const c of process.stdin) raw += c;
const v = JSON.parse(raw);
await new Promise((r) => setTimeout(r, 250));
const round = (v.round ?? 0) + 1;
process.stdout.write(JSON.stringify({ task: v.task, title: v.title, needs: v.needs, round }));
