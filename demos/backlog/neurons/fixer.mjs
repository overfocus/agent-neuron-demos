// The bug-fixing agent (a script with canned, invented patches): it takes a
// bug and answers its patch - the files it touches, and anything it adds.
import { answer, data, input, latency, sleep } from './io.mjs';

const bug = await input();
const found = data().bugs.find((b) => b.id === bug.id);
await sleep(latency(bug.id, 400, 1400));
answer({ id: bug.id, title: bug.title, ...found.patch });
