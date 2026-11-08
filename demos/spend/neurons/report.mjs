// A finished task: one line on stdout (the critic sends only its "done" here).
let raw = '';
for await (const c of process.stdin) raw += c;
const v = JSON.parse(raw);
process.stdout.write(JSON.stringify(`${v.task} done in ${v.round} rounds`));
