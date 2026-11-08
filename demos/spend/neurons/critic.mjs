// The critic, a serve neuron so it can say where its verdict goes: "more"
// back to the researcher, "done" to the report alone. (A run neuron's answer
// goes down every link, and a researcher called only to stay quiet still
// spends its cost.)
import readline from 'node:readline';

const send = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const m = JSON.parse(line);
  if (m.type === 'hello') return send({ v: 1, type: 'ready' });
  if (m.type === 'ping') return send({ type: 'pong', n: m.n });
  if (m.type === 'cancel') return send({ type: 'quiet', re: m.re });
  if (m.type !== 'signal') return;
  const v = m.payload;
  const verdict = v.round >= v.needs ? 'done' : 'more';
  setTimeout(() => send({ type: 'answer', re: m.re, payload: { ...v, verdict }, to: [verdict === 'done' ? 'report' : 'researcher'] }), 120);
}).on('close', () => process.exit(0));
