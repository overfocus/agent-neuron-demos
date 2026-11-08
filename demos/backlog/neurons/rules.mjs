// The house rules, as data (house-rules.json), checked against each patch:
// a dependency the team never chose is a lock-in; a second config system or
// a second helper for something a helper already does is a slop grenade.
import { answer, input, rules } from './io.mjs';

const patch = await input();
const r = rules();
const findings = [];
let verdict = 'clean';
if (patch.dependency && !r.dependencies.includes(patch.dependency)) {
  verdict = 'lock-in';
  findings.push(`adds the dependency ${patch.dependency}, which the team has not chosen (allowed: ${r.dependencies.join(', ')})`);
}
if (patch.config && patch.config !== r.config) {
  verdict = verdict === 'clean' ? 'slop' : verdict;
  findings.push(`adds a second config system (${patch.config}); the one config is ${r.config}`);
}
if (patch.helper) {
  const same = Object.entries(r.helpers).find(([, does]) => does === patch.helper.does);
  if (same) {
    verdict = verdict === 'clean' ? 'slop' : verdict;
    findings.push(`adds ${patch.helper.name}() to ${patch.helper.does}; ${same[0]}() already does`);
  }
}
answer({ ...patch, verdict, findings });
