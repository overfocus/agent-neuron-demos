#!/usr/bin/env node
// npm run demo <name> [-- --headless] [-- other flags]: runs one demo.
// With no name, lists them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEMOS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../demos');
const names = fs
  .readdirSync(DEMOS)
  .filter((n) => fs.existsSync(path.join(DEMOS, n, 'demo.mjs')))
  .sort();

const [name, ...flags] = process.argv.slice(2);
if (!name || !names.includes(name)) {
  if (name) console.log(`no demo called ${name}\n`);
  console.log('npm run demo <name> [-- --headless]\n');
  for (const n of names) {
    const { meta } = await import(pathToFileURL(path.join(DEMOS, n, 'demo.mjs')).href);
    console.log(`  ${n.padEnd(10)} ${meta.title}${meta.variants?.length ? `  [${meta.variants.join(' ')}]` : ''}`);
  }
  process.exit(name ? 2 : 0);
}
const mod = await import(pathToFileURL(path.join(DEMOS, name, 'demo.mjs')).href);
const result = await mod.main({ headless: flags.includes('--headless'), flags });
process.exit(result?.code ?? 0);
