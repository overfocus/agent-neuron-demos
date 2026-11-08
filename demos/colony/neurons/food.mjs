// A food source. argv: its stock and when it appears (ms after start). Before
// that, it is quiet. Once eaten, it answers every arrival: left 0 and emptied
// true, instead of quiet - the dry patch is visible, so the nest can mark the
// trail dead and the wasted trips can be counted. Otherwise one unit goes
// with the ant, back to the nest (the answer's forward).
import { serve, sleep } from './serve.mjs';

let stock = Number(process.argv[2]);
const appears = Date.now() + Number(process.argv[3] ?? 0);

serve(async (p) => {
  if (Date.now() < appears) return undefined;
  if (stock <= 0) return { payload: { food: p.food, ant: p.ant, trip: p.trip, left: 0, emptied: true } };
  stock -= 1;
  await sleep(40);
  return { payload: { food: p.food, ant: p.ant, trip: p.trip, left: stock } };
}, { maxInflight: 16 });
