// A food source. argv: its stock and when it appears (ms after start). Before
// that, or once eaten, an ant that arrives finds nothing (quiet). Otherwise
// one unit goes with the ant, back to the nest (the answer's forward).
import { serve, sleep } from './serve.mjs';

let stock = Number(process.argv[2]);
const appears = Date.now() + Number(process.argv[3] ?? 0);

serve(async (p) => {
  if (Date.now() < appears || stock <= 0) return undefined;
  stock -= 1;
  await sleep(40);
  return { payload: { food: p.food, ant: p.ant, trip: p.trip, left: stock } };
}, { maxInflight: 16 });
