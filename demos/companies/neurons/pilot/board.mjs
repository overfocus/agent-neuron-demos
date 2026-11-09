// The boarding team: the slow part of the pilotage, and the exit the quay
// office sees. Their answer crosses the boundary back and becomes our
// harbourmaster's ask - their marks (triaged, the chart room's tide, boarded)
// ride on it, framed by them for the decision they will never see.
import readline from 'node:readline';

readline.createInterface({ input: process.stdin }).once('line', (raw) => {
  const a = JSON.parse(raw);
  setTimeout(() => {
    process.stdout.write(
      JSON.stringify({
        ...a,
        boarded: true,
        title: `Clear ${a.vessel} with the pilot office?`,
        answerable_by: 'harbourmaster',
        notes: [
          `their triage clerk took the ask at ${a.office === 'quay' ? 'the boundary' : a.office}`,
          `the chart room says: ${a.chart}`,
          `the hire is an effect across the border: committed once, never guessed`,
        ],
        options: [
          { id: 'clear', label: 'Clear: the pilot meets the vessel', text: `clear ${a.vessel}, ${a.cargo}, pilot meets at ${a.due}` },
          { id: 'hold', label: 'Hold: ask the pilot office again', text: `hold ${a.vessel}` },
        ],
      }),
    );
  }, 3000);
});
