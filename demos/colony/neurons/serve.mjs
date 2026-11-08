// A level 1 (serve) neuron in a few lines: the hello/ready handshake, then
// one handler per signal. The handler's result is the reply: undefined is
// quiet, {payload, to?} an answer. ping is answered; stdin closing ends it.
import readline from 'node:readline';

export function serve(onSignal, { maxInflight = 1 } = {}) {
  const send = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
  readline.createInterface({ input: process.stdin }).on('line', async (line) => {
    if (!line.trim()) return;
    const m = JSON.parse(line);
    if (m.type === 'hello') send({ v: 1, type: 'ready', maxInflight });
    else if (m.type === 'ping') send({ type: 'pong', n: m.n });
    else if (m.type === 'cancel') send({ type: 'quiet', re: m.re });
    else if (m.type === 'signal') {
      try {
        const r = await onSignal(m.payload);
        send(r === undefined ? { type: 'quiet', re: m.re } : { type: 'answer', re: m.re, ...r });
      } catch (e) {
        send({ type: 'error', re: m.re, message: String(e?.message ?? e) });
      }
    }
  }).on('close', () => process.exit(0));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
