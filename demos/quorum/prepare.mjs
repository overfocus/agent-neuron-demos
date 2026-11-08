// The scratch repo the team decides about, rebuilt on every run under
// runs/quorum/repo: one seed commit of a small invented module (a ferry
// timetable) and two real agent branches, each a small diff in its own voice.
// Nothing here touches any other repository.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const BRANCHES = ['agent/patch-a', 'agent/patch-b'];

export function prepareRepo(repo) {
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), text);
  };
  fs.rmSync(repo, { recursive: true, force: true });
  fs.mkdirSync(repo, { recursive: true });
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'the ferry team (invented)');
  git('config', 'user.email', 'demo@agent-neuron.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');

  write('ferry/README.md', '# ferry\n\nAn invented ferry timetable. Two agents want to change when the last boat leaves.\n');
  write(
    'ferry/departures.mjs',
    [
      '// When the ferry leaves: a fixed list, as seeded.',
      'export const DEPARTURES = ["07:00", "09:30", "12:00", "15:30", "18:00"];',
      '',
      'export function nextDeparture(now) {',
      '  return DEPARTURES.find((t) => t > now) ?? null;',
      '}',
      '',
    ].join('\n'),
  );
  git('add', '-A');
  git('commit', '-q', '-m', 'seed: the ferry timetable (invented)');

  // patch-a: the last boat follows the tide.
  git('checkout', '-q', '-b', BRANCHES[0]);
  write(
    'ferry/departures.mjs',
    [
      '// When the ferry leaves: a fixed list, and a last boat that waits for the tide.',
      'export const DEPARTURES = ["07:00", "09:30", "12:00", "15:30", "18:00"];',
      '',
      'export function nextDeparture(now, highWater) {',
      '  const fixed = DEPARTURES.find((t) => t > now);',
      '  if (fixed) return fixed;',
      '  return highWater && highWater > now ? highWater : null;',
      '}',
      '',
    ].join('\n'),
  );
  git('commit', '-q', '-am', 'patch-a: the last boat waits for high water');

  // patch-b: a new evening sailing, fixed.
  git('checkout', '-q', 'main');
  git('checkout', '-q', '-b', BRANCHES[1]);
  write(
    'ferry/departures.mjs',
    [
      '// When the ferry leaves: a fixed list, with an evening sailing.',
      'export const DEPARTURES = ["07:00", "09:30", "12:00", "15:30", "18:00", "20:30"];',
      '',
      'export function nextDeparture(now) {',
      '  return DEPARTURES.find((t) => t > now) ?? null;',
      '}',
      '',
    ].join('\n'),
  );
  git('commit', '-q', '-am', 'patch-b: add a fixed 20:30 sailing');
  git('checkout', '-q', 'main');
  return git('log', '--oneline', '--graph', '--all', '--decorate');
}
