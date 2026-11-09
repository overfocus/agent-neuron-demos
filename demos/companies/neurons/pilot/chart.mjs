// The chart room: the pilot office's own supplier, on a third engine. To the
// pilot office it is one placed node; the tide it reads back is the deepest
// mark on the answer the quay office finally sees.
import readline from 'node:readline';

readline.createInterface({ input: process.stdin }).once('line', (raw) => {
  const a = JSON.parse(raw);
  process.stdout.write(JSON.stringify({ ...a, chart: `tide window ${a.due} holds`, room: 'chart' }));
});
