#!/usr/bin/env node
import { loadConfig } from './config.js';

const DEFAULTS = { port: 8080, greeting: 'hi' };
let config;
try {
  config = { ...DEFAULTS, ...loadConfig(process.argv[2] ?? 'config.json') };
} catch (error) {
  process.stderr.write(`bad config: ${error.message}\n`);
  process.exit(1);
}
process.stdout.write(`listening on ${config.port}\n`);
