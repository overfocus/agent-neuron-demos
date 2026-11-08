// A food source. argv: its id, its stock, when it appears (ms after start) and
// its distance from the nest in ms. Before that, it is quiet. Once eaten, it
// answers every arrival: left 0 and emptied true, instead of quiet - the dry
// patch is visible, so the nest can mark the trail dead and the wasted trips
// can be counted. It answers with its OWN id and distance: a forager's trip
// message names the patch the ant set out for, but the engine's seeded pick of
// routes (the network file's ground) decides where the message lands, so the
// trail the engine weighs must be the one actually walked. One unit goes with
// the ant, back to the nest (the answer's forward).
import { serve, sleep } from './serve.mjs';

const [id, stockArg, appearsArg, distArg] = process.argv.slice(2);
let stock = Number(stockArg);
const appears = Date.now() + Number(appearsArg ?? 0);
const trip = Number(distArg ?? 0);

serve(async (p) => {
  if (Date.now() < appears) return undefined;
  if (stock <= 0) return { payload: { food: id, ant: p.ant, trip, left: 0, emptied: true } };
  stock -= 1;
  await sleep(40);
  return { payload: { food: id, ant: p.ant, trip, left: stock } };
}, { maxInflight: 16 });
