// Under the limit, a refund pays without a person: pass it on. Over, quiet.
import { answer, data, input } from './io.mjs';
const r = await input();
if (r.amount <= data().limit) answer(r);
