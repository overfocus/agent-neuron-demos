// The triage agent (canned): reads an alert and proposes one remediation, as
// the on-call person's ask.
let raw = '';
for await (const c of process.stdin) raw += c;
const a = JSON.parse(raw);
await new Promise((r) => setTimeout(r, 600));
process.stdout.write(
  JSON.stringify({
    title: `${a.service}: ${a.alert}`,
    answerable_by: 'oncall',
    notes: [`seen at ${a.seen}`, `the agent proposes: ${a.proposal}`, 'A newer alert for this service replaces this ask: it is withdrawn, and an answer to it is refused.'],
    options: [
      { id: 'do', label: a.proposal, text: `do ${a.service}: ${a.proposal}` },
      { id: 'hold', label: 'Hold: watch it', text: `hold ${a.service}` },
    ],
  }),
);
