// The customer's receipt: only for a payment that was forwarded.
import { answer, input } from './io.mjs';
const t = String(await input());
answer(`receipt sent: ${t}`);
