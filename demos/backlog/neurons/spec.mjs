// The spec agent (canned): turns a one-line requirement into acceptance
// criteria, and asks both ICs, with the ask as the draft and its criteria as
// the proposal, so the desk shows what the agent added.
import { answer, data, input, latency, sleep } from './io.mjs';

const req = await input();
const r = data().requirements.find((x) => x.id === req.id);
await sleep(latency(req.id, 500, 1500));
answer({
  title: `${r.id}: ${r.title} - are these the acceptance criteria?`,
  answerable_by: 'ic',
  draft: r.ask,
  proposal: r.criteria,
  notes: ['Both ICs must accept for it to be scheduled.'],
  options: [
    { id: 'accept', label: 'Accept the criteria', text: `accept ${r.id}` },
    { id: 'back', label: 'Send back to product', text: `back ${r.id}` },
  ],
});
