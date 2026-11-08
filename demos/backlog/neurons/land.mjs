// Landing a fix: an effect (never cut; a crash is unknown). A clean patch
// lands on its own; a flagged one lands only on the lead's "land <id>";
// "rework <id>" lands nothing. Each landing is a line in landed.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { answer, input, runDir } from './io.mjs';

const v = await input();
let id;
let how;
if (typeof v === 'object' && v.verdict === 'clean') [id, how] = [v.id, 'auto'];
else if (typeof v === 'string' && /^land \S+$/.test(v.trim())) [id, how] = [v.trim().split(' ')[1], 'lead'];
else process.exit(0);
fs.appendFileSync(path.join(runDir(), 'landed.jsonl'), `${JSON.stringify({ id, how })}\n`);
answer(`landed ${id}${how === 'lead' ? ' (the lead let it through)' : ''}`);
