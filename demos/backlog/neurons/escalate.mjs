// Only what the house rules flagged goes to a person: a clean patch is quiet
// here (it lands on its own). A flagged one becomes the lead's ask.
import { answer, input } from './io.mjs';

const p = await input();
if (p.verdict === 'clean') process.exit(0);
answer({
  title: `${p.id}: the agent's fix is ${p.verdict === 'slop' ? 'slop' : 'a lock-in'} - ${p.title}`,
  answerable_by: 'lead',
  notes: [`the fix: ${p.summary} (${p.files.join(', ')})`, ...p.findings],
  options: [
    { id: 'land', label: 'Land it anyway', text: `land ${p.id}` },
    { id: 'rework', label: 'Send it back to the agent', text: `rework ${p.id}` },
  ],
});
