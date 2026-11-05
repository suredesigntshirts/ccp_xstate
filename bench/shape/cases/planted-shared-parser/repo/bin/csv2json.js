#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parse } from '../src/parse.js';

process.stdout.write(`${JSON.stringify(parse(readFileSync(0, 'utf8')))}\n`);
