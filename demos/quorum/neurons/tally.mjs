// The quorum join (threshold 2): both reviewers' choices arrive together as
// `{payload, inputs}`, each a branch name (the text of the option they chose).
// It answers the lead's gate as one desk ask: on agreement, the agreed branch
// with its real diff as the draft/proposal pair and one Merge option; on a
// tie, both branches as options. The lead's No merges nothing.
import { execFileSync } from 'node:child_process';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const repo = process.env.DEMO_REPO;
  const { inputs = [] } = JSON.parse(raw);
  const votes = inputs.map((v) => String(v).trim());
  const git = (...args) => {
    try {
      return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
    } catch {
      return '';
    }
  };
  const agreed = votes.length === 2 && votes[0] === votes[1] ? votes[0] : null;
  const branches = [...new Set(votes)];
  const options = branches.map((b) => ({ id: b.replace(/[^a-z0-9]+/gi, '-'), label: `Merge ${b}`, text: `merge ${b}` }));
  const stat = (b) => git('diff', '--shortstat', `main...${b}`).trim() || 'no change';
  const ask = agreed
    ? (() => {
        const file = git('diff', '--name-only', `main...${agreed}`).split('\n')[0];
        return {
          title: `Both reviewers chose ${agreed}: merge it?`,
          answerable_by: 'lead',
          draft: git('show', `main:${file}`),
          proposal: git('show', `${agreed}:${file}`),
          notes: [`${file}: ${stat(agreed)}`, 'Merge runs git merge --no-ff for real; No merges nothing.'],
          options,
        };
      })()
    : {
        title: `The reviewers split: ${branches.join(' vs ')}. Your call.`,
        answerable_by: 'lead',
        notes: [...branches.map((b) => `${b}: ${stat(b)}`), 'Pick one to merge, or No to send both back.'],
        options,
      };
  process.stdout.write(JSON.stringify(ask));
});
