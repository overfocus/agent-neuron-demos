// The architecture agent (canned): drafts the decision record, with the
// state of things as the draft and the change as the proposal, for both ICs.
import { answer, data, input, latency, sleep } from './io.mjs';

const req = await input();
const a = data().architecture.find((x) => x.id === req.id);
await sleep(latency(req.id, 600, 1600));
answer({
  title: `${a.id}: ${a.title} - should we?`,
  answerable_by: 'ic',
  draft: a.now,
  proposal: a.proposal,
  notes: ['Your advice goes to the lead, who decides. It is recorded either way.'],
  options: [
    { id: 'accept', label: 'Advise: adopt', text: `accept ${a.id}` },
    { id: 'reject', label: 'Advise: reject', text: `reject ${a.id}` },
  ],
});
