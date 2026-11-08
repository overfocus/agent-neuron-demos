// What every demo prints the same way: the table (one URL per person), and
// each desk answer or refusal as a sentence with the person's name.

import { spawn } from 'node:child_process';

/** Open a URL in the default browser (--open), on macOS or Linux. */
export function openUrl(url) {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

export function printTable(run, say) {
  say('');
  say('The desk (open each in its own window; the owner link answers anything):');
  for (const p of Object.values(run.people)) {
    say(`  ${p.name.padEnd(5)} (${p.roles.join(', ') || 'no role'}): ${p.url}`);
  }
  if (run.owner) say(`  owner: ${run.owner.url}`);
  if (process.env.DEMO_OPEN) for (const p of Object.values(run.people)) openUrl(p.url);
  say('');
}

export function deskLine(run, kind, a) {
  const who = run.people[a.by]?.name ?? a.by ?? 'owner';
  if (kind === 'refused') return `desk: refused ${who} on ${a.neuron} (${a.why})`;
  const why = a.why ? ` (why: ${a.why})` : '';
  if (a.kind === 'choose') return `desk: ${who} chose ${a.text}${why}`;
  if (a.kind === 'no') return `desk: ${who} said no${why}`;
  if (a.kind === 'approve') return `desk: ${who} approved${why}`;
  return `desk: ${who} answered "${a.text}"${why}`;
}
