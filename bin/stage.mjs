#!/usr/bin/env node
// npm run stage [-- --open]: the stage on its own (lib/stage.mjs). Open it
// once, then run demos in another terminal; it follows each run.
// `npm run watch <demo>` starts the stage, the viewer and the demo in one go.
import { openUrl } from '../lib/narrate.mjs';
import { answering, startStage, VIZ_URL } from '../lib/stage.mjs';

const stage = await startStage();
if (!stage) {
  console.log('stage: the port is taken (STAGE_PORT, default 5190): is a stage already running?');
  process.exit(1);
}
console.log(`stage: ${stage.url}`);
if (!(await answering(VIZ_URL))) console.log(`stage: the viewer is not answering at ${VIZ_URL}: start it with (cd ../agent-neuron-viz && npm run dev)`);
console.log('stage: now run any demo in another terminal, e.g. npm run demo backlog -- --headless --pace 2');
if (process.argv.includes('--open')) openUrl(stage.url);
