// Writing the decision record: an effect. Adopted or rejected, the decision
// is a file (adr/<id>.md); the lead's No writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { answer, data, input, runDir } from './io.mjs';

const t = String(await input()).trim();
const [verb, id] = t.split(' ');
if (!['adopt', 'reject'].includes(verb)) process.exit(0);
const a = data().architecture.find((x) => x.id === id);
const dir = path.join(runDir(), 'adr');
fs.mkdirSync(dir, { recursive: true });
const status = verb === 'adopt' ? 'adopted' : 'rejected';
fs.writeFileSync(path.join(dir, `${id}.md`), `# ${id}: ${a.title}\n\nStatus: ${status}\n\n## Before\n\n${a.now}\n\n## The change\n\n${a.proposal}\n`);
answer(`${id} ${status}`);
