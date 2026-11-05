#!/usr/bin/env node
import { greeting } from '../src/greet.js';

const name = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!name) {
  process.stderr.write('usage: greet <name>\n');
  process.exit(2);
}
process.stdout.write(`${greeting(name)}\n`);
