# agent-neuron-demos

Demos of agent-neuron's decision surface (Node 22, ESM, no dependencies). Each
demo runs the agent-neuron Rust engine's command line (`neuron-engine run`)
from the sibling checkout; see README.md.

- Run `npm test` before you finish: every demo headless against the real
  engine, with its outcome asserted.
- What a demo needs from the engine goes into agent-neuron (with its tests,
  docs and a decision record), not into a proxy here. The desk, grants,
  choices and the record are the engine's; `lib/desk.mjs` only calls them.
- Check every network file with `neuron-engine check` after changing it.
- Use invented data only: no real names, emails, accounts or paths.
- A demo writes only under `runs/` (git-ignored), never into tracked files.
- Relative imports carry their `.js`/`.mjs` extension.
- A push to `main` publishes the repo: no push without Kevin's go-ahead.
