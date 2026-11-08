// Both ICs have advised on an architecture change (threshold 2): the lead's
// ask, with their advice in the notes and the change as the proposal.
import { answer, data, input } from './io.mjs';

const { inputs } = await input();
const words = inputs.map((t) => String(t).trim().split(' '));
const id = words[0][1];
const a = data().architecture.find((x) => x.id === id);
const advice = words.map((w) => w[0]);
answer({
  title: `${id}: ${a.title} - the ICs advise ${advice.join(' / ')}`,
  answerable_by: 'lead',
  draft: a.now,
  proposal: a.proposal,
  notes: [advice[0] === advice[1] ? `Both ICs advise: ${advice[0]}.` : 'The ICs disagree. Their reasons are in the record below.'],
  options: [
    { id: 'adopt', label: 'Adopt', text: `adopt ${id}` },
    { id: 'reject', label: 'Reject', text: `reject ${id}` },
  ],
});
