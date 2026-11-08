// The refund agent (canned): checks the request against the booking and
// proposes the refund. Every request gets the same check.
import { answer, data, input, sleep } from './io.mjs';
const r = await input();
const found = data().requests.find((x) => x.id === r.id);
await sleep(300);
answer({ id: found.id, account: found.account, amount: found.amount, reason: found.reason });
