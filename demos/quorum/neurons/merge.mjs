// The merge: an effect (a started call is never cut; a crash is `unknown`).
// It takes the lead's text, "merge <branch>", checks the branch against the
// whitelist in argv before any git call (no shell, no eval), and merges it
// into main of the scratch repo named by DEMO_REPO.
import { execFileSync } from 'node:child_process';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const allow = process.argv.slice(2);
  const repo = process.env.DEMO_REPO;
  const refuse = (why) => {
    process.stderr.write(`merge refused: ${why}\n`);
    process.exit(2);
  };
  const text = JSON.parse(raw);
  const m = typeof text === 'string' ? text.trim().match(/^merge (\S+)$/) : null;
  if (!repo) refuse('DEMO_REPO is not set');
  if (!m) refuse(`not "merge <branch>": ${JSON.stringify(text)}`);
  if (!allow.includes(m[1])) refuse(`${m[1]} is not one of ${allow.join(', ')}`);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('merge', '--no-ff', '-q', '-m', `merge ${m[1]} (decided at the desk)`, m[1]);
  process.stdout.write(JSON.stringify(`merged ${m[1]} at ${git('rev-parse', '--short', 'HEAD')}`));
});
