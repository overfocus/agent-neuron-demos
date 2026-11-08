# Getting started

From nothing to watching a team of agents and people decide together, in
about five minutes. Then, a shot list per demo for recording them.

## The one-liner

You need **Node 22**, **git** and a **Rust toolchain** ([rustup.rs](https://rustup.rs)):
the demos run agent-neuron's Rust engine, which is built the first time. In an
empty folder:

```sh
git clone https://github.com/overfocus/agent-neuron-demos && cd agent-neuron-demos && npm run setup && npm run watch colony
```

`npm run setup` clones agent-neuron and agent-neuron-viz next to this repo,
installs the viewer and builds the engine (safe to run again). `npm run watch
<demo>` starts the viewer if it is not running, opens one page with the
network in 3D and every person's desk, and runs the demo with the invented
people answering at a pace you can follow. When the run ends the page stays
up to replay it; Ctrl-C stops everything `watch` started.

```sh
npm run watch quorum                  # the people answer, every 2 s
npm run watch backlog -- --pace 3     # slower
npm run watch quorum -- --live        # you answer, on the desks in the page
npm run watch colony -- --ants 40     # any demo flag passes through
```

The rest of this guide takes the same steps one at a time.

## 1. Set up (once), by hand

```sh
mkdir agent-neuron && cd agent-neuron
git clone https://github.com/overfocus/agent-neuron
git clone https://github.com/overfocus/agent-neuron-demos
git clone https://github.com/overfocus/agent-neuron-viz      # optional: the 3D view
(cd agent-neuron-viz && npm install)

cd agent-neuron-demos
npm run doctor        # checks everything, builds the engine if it is missing
```

The three checkouts sit side by side; that is how they find each other. (Set
`AGENT_NEURON_ROOT` if your agent-neuron is somewhere else.)

## 2. Your first demo (two minutes)

```sh
npm run demo quorum -- --headless
```

Two agents have each written a patch, on real branches of a scratch git
repo. Two reviewers (Ada and Lin) choose one; the lead (Sam) gates the merge.
`--headless` means the invented people answer by themselves, through the same
desk your browser would use. You will see each decision with its reason, Lin
being refused when she tries to answer the lead's question, and the real
`git log` with the merge in it.

Now be the people yourself:

```sh
npm run demo quorum -- --open
```

`--open` opens one desk page per person. Choose a patch on Ada's page, then
on Lin's: the moment both have chosen, Sam's page gets the merge question,
with the real diff. Try answering Sam's question from Lin's page: you can't.

## 3. Watch it in 3D

In a second terminal:

```sh
cd ../agent-neuron-viz && npm run dev        # http://localhost:5180/?attach
```

Open `http://localhost:5180/?attach`, then run any demo. The viewer draws the
network the moment a run starts and plays its events live: signals along the
links, answers arcing back, a person's neuron breathing (`waiting 2`) while
the desk waits on them, a ⚑ on anything irreversible.

## 4. The rest of the series

```sh
npm run demo                       # the list
npm run demo backlog -- --headless # 15 bugs, 5 requirements, 2 architecture changes, a team of three
npm run demo spend -- --headless   # the manager lowers the budget, as a policy diff
npm run demo refunds -- --headless # an irreversible payment, a duplicate, a crash nobody can call
npm run demo oncall -- --headless  # a decision that goes stale before it is made
npm run demo colony                # 24 ants, food, a nest, and no one in charge
npm test                           # every demo, its outcome asserted
```

Flags that work on every demo with people:

| Flag | What it does |
|---|---|
| `--headless` | the invented people answer by themselves |
| `--pace <seconds>` | how long they "read" before each answer (default: a blink); 2 to 4 is watchable |
| `--open` | open each person's desk page in your browser |

The colony takes `--ants <n>` and `--seconds <s>`; quorum takes `--tie`.

Every run leaves its trace, live stream and stderr under `runs/<demo>/`.

---

## Recording the demos

### The stage

```sh
npm run watch backlog -- --pace 3
```

or, to keep the page open between many takes, the same pieces by hand:

```sh
# terminal 1: the viewer
cd ../agent-neuron-viz && npm run dev
# terminal 2: the stage
npm run stage -- --open                      # http://127.0.0.1:5190/
# terminal 3: the demos, one take after another
npm run demo backlog -- --headless --pace 3
```

The stage is one page built to be recorded: the 3D view on the left, each
person's live desk stacked on the right, the demo's title on top. Open it
once; it re-points itself at every new run. Each desk page shows its own
person's turn first, and everyone else's items as one line ("waiting on
Sam").

Tips:

- **Window**: record the stage at 1600×1000 or larger; below 760 px wide it
  stacks the desks under the view.
- **Pace**: `--pace 3` for the decision demos is a good speed to narrate over;
  `--pace 2` when the run has many decisions (backlog has 20).
- **Two takes**: record a `--headless --pace` take for the flow, then a live
  take where you click the desk yourself (`--open`, or click inside the
  stage's desks).
- **Reset**: every run starts clean (its `runs/<demo>/` folder is emptied),
  so a retake is just the command again.
- **The terminal** tells the story in sentences ("desk: Sam chose land
  BUG-04 (why: ...)"); keep it on screen or cut to it for the summary at the end.
- **Desk links carry tokens.** They are local and die with the run, but blur
  them if a frame shows a full URL.

### Shot lists

Times are at the pace shown, on a laptop; agents and people overlap, so the
order of lines in the terminal can vary a little from take to take.

#### quorum (≈ 15 s at `--pace 3`)

`npm run demo quorum -- --headless --pace 3`

1. The terminal prints the scratch repo's branch graph: `main` and two agent branches.
2. The stage draws `patches → ic1, ic2 → tally → lead → merge ⚑`. Both reviewer neurons breathe: `waiting 1`.
3. Ada chooses patch-a with her reason; her desk shows "decided". `ic1` stops breathing.
4. Lin chooses patch-a. `tally` fires (it waits for both: threshold 2) and Sam's desk gets the merge question **with the real diff** as draft and proposal.
5. Lin tries to answer Sam's question: refused (403), and the terminal says so. *This is the grants line: who may decide what.*
6. Sam merges. The terminal prints the new `git log --graph` with the merge commit.

Variant: `--tie`. Lin picks patch-b; Sam's question offers both; Sam says No; nothing merges.

#### backlog (≈ 30 s at `--pace 4`)

`npm run demo backlog -- --headless --pace 3`

1. Fifteen bugs, five requirements and two architecture changes flow in, staggered. Three lanes in the 3D view: bugs (fixer → rules → land/escalate), requirements (spec → both ICs → plan), architecture (adr → both ICs → council → lead → record ⚑).
2. Clean fixes land on their own: `land: landed BUG-01`, `BUG-02`, … no person involved.
3. `rules: BUG-04 is a lock-in - to the lead`: the agent added a dependency the team never chose. Sam's desk shows the findings. *The house rules are a data file in the repo, not anyone's prompt.*
4. `budget: BUG-15 refused at fixer`: a P4 bug was injected with a smaller budget and the fix never starts.
5. Ada and Lin each see the agent's acceptance criteria as a diff against the original ask; both accept → `plan: scheduled REQ-1`.
6. Lin sends REQ-5 back with a reason: `sent REQ-5 back to product (1 of 2 accepted)`.
7. ARCH-1: both ICs advise adopt, Sam adopts, `record` writes the decision record. ARCH-2: the ICs split, Sam rejects, and the rejection is written down too.
8. The summary: 10 landed on their own, 4 flagged (1 let through), 1 refused by budget, 4 of 5 requirements scheduled, ARCH-1 adopted, ARCH-2 rejected, **20 decisions, each with who and why**.

#### spend (≈ 15 s at `--pace 3`; three runs in a row)

`npm run demo spend -- --headless --pace 3`

1. Round 1: five research tasks loop researcher ↔ critic in the 3D view. Two never finish and burn their full 12 credits each.
2. The stage switches to the review: Sam's desk shows the spend per task and three choices (keep 12, lower to 9, lower to 6).
3. Sam picks 9 with a reason. The terminal prints the policy change **as a diff**.
4. Round 2 under 9: the same three tasks finish; the runaways are cut off sooner. Totals: 48 → 42 credits.

#### refunds (≈ 15 s at `--pace 3`, plus a reconcile run)

`npm run demo refunds -- --headless --pace 3`

1. Seven refunds. Small ones pay on their own; R-3, R-4 and R-6 (over 50) wait on Sam's desk. `pay` carries the ⚑: it is an effect.
2. R-2 is sent again while its first payment is still running. The payment is **not cut**; its answer is recorded but not forwarded (`[stale: ... not forwarded]`), and the duplicate returns the first payment's result: one payment, one receipt.
3. Sam pays R-3, denies R-4 (reason on the record), pays R-6.
4. R-6's connection drops after the money moved: `UNKNOWN`, not an error. *Nobody can say whether it happened, and the trace says exactly that.*
5. The stage switches to the reconcile run: `lookup: R-6 WAS paid ... Do not pay again.`

#### oncall (≈ 10 s at `--pace 3`)

`npm run demo oncall -- --headless --pace 3`

1. Two alerts: payments latency (proposal: restart) and search disk (proposal: clear cache). Kit's desk shows both.
2. Kit opens the payments ask and "reads the dashboards".
3. A newer payments alert arrives: error rate since a deploy. The first ask is **withdrawn** from Kit's desk, and a new one (roll back) takes its place.
4. Kit answers the old one anyway: refused, `410 ... withdrawn`. *A decision does not outlive the situation it was about.*
5. Kit holds search and rolls back payments; `act` does it.

#### colony (45 s by default)

`npm run demo colony` (or `-- --ants 40 --seconds 60` for a fuller screen)

1. The 3D view: the clock on the left, the ants, four food sources, the nest on the right. No neuron gives orders.
2. The first seconds: ants explore; the near berries trail lights up as deliveries reach the nest.
3. The terminal every 5 s: hunger and the strength of each trail.
4. A quarter of the way in, a new near patch (honeydew) appears. Explorers find it while the berries trail is still busy.
5. The berries run out part-way: that link goes dark, and the traffic moves. Usually (four takes in five) it moves to the honeydew, whose short trip lays the most pheromone; sometimes the seeds trail has taken hold and keeps it. Both are real colony behaviour; say which one this take shows, or run it again.
6. The table at the end: deliveries per food per 5 s, and the eager ants (low threshold) doing several times the trips of the reluctant ones.
