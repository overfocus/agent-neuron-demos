// Over the limit: the person's ask. Under, quiet.
import { answer, data, input } from './io.mjs';
const r = await input();
const { limit } = data();
if (r.amount <= limit) process.exit(0);
answer({
  title: `${r.id}: refund ${r.amount} to ${r.account}?`,
  answerable_by: 'approver',
  notes: [`reason given: ${r.reason}`, `over the ${limit} limit, so a person decides`, 'Paying is an effect: once it starts it is never cut, and a crash is recorded as unknown.'],
  options: [
    { id: 'pay', label: `Pay ${r.amount}`, text: `pay ${r.id}` },
    { id: 'deny', label: 'Deny', text: `deny ${r.id}` },
  ],
});
