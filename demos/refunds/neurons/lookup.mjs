// Reconciling an unknown: read the ledger and say what happened.
import { answer, input, paid } from './io.mjs';
const { id } = await input();
const p = paid().find((x) => x.id === id);
answer(p ? `${id} WAS paid (${p.amount} to ${p.account}): the crash came after the money moved. Do not pay again.` : `${id} was not paid: safe to retry.`);
