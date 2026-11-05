import { readFileSync } from 'node:fs';

/** The settings in a JSON file. */
export function loadConfig(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
