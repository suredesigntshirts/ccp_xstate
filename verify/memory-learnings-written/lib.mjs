// Shared by this folder's tests: the checkout under test, its notes files split into sections, and term matching that
// ignores case and line breaks, as the questions guard does.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REPO = join(import.meta.dirname, '..', '..');
export const read = (path, root = REPO) => readFileSync(join(root, path), 'utf8');
export const flat = (text) => text.replace(/\s+/g, ' ').toLowerCase();

/** The text under each heading of a markdown file at `level` (## or ###), keyed by the heading's words. */
export function sections(path, level = '##') {
  const out = {};
  let at = null;
  for (const line of read(path).split('\n')) {
    if (line.startsWith(`${level} `)) { at = line.slice(level.length + 1).trim(); out[at] = ''; continue; }
    if (at !== null) out[at] += `${line}\n`;
  }
  return out;
}

/** The terms of `terms` that `text` lacks. */
export const lacking = (text, terms) => terms.filter((t) => !flat(text).includes(flat(t)));
