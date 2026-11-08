// Paying a refund: an effect. Idempotent by the refund id: a refund already
// claimed is not paid twice. R-6's connection drops after the money
// moved (exit 1 after the write): the engine cannot know whether it was paid,
// and records unknown.
import fs from 'node:fs';
import { answer, data, input, ledger, paid, sleep } from './io.mjs';
const v = await input();
let id;
if (typeof v === 'object') id = v.id;
else if (/^pay \S+$/.test(String(v).trim())) id = String(v).trim().split(' ')[1];
else process.exit(0); // "deny R-x": nothing to pay
const r = data().requests.find((x) => x.id === id);
// The idempotency key, claimed before anything is sent: a second call for
// the same refund (a resubmitted request) finds the claim and sends nothing.
try {
  fs.closeSync(fs.openSync(`${process.env.DEMO_DIR}/claim-${id}`, 'wx'));
} catch {
  // Claimed already: answer with that payment's result (an idempotent call
  // returns the first call's outcome), once the ledger has it.
  for (let i = 0; i < 100; i++) {
    const first = paid().find((p) => p.id === id);
    if (first) {
      answer(`paid ${first.amount} to ${first.account} for ${id} (one payment: this request was a duplicate)`);
      process.exit(0);
    }
    await sleep(100);
  }
  process.stderr.write(`${id} was claimed but never reached the ledger\n`);
  process.exit(1);
}
await sleep(r.slow ? 1800 : 400);
fs.appendFileSync(ledger(), `${JSON.stringify({ id, account: r.account, amount: r.amount, t: Date.now() })}\n`);
if (r.crash) {
  process.stderr.write('connection to the payment provider dropped after the request was sent\n');
  process.exit(1);
}
answer(`paid ${r.amount} to ${r.account} for ${id}`);
