// Both ICs' answers on one requirement (threshold 2): scheduled only when
// both accepted.
import { answer, input } from './io.mjs';

const { inputs } = await input();
const words = inputs.map((t) => String(t).trim().split(' '));
const id = words[0][1];
const accepted = words.filter((w) => w[0] === 'accept').length;
answer(accepted === 2 ? `scheduled ${id}` : `sent ${id} back to product (${accepted} of 2 accepted)`);
