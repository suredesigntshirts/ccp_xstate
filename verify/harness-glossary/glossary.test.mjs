// glossary-real: docs/language.md has the four context sections and a line for every term the item's outputs list,
// and every path, export, row kind and run-folder file a line names exists in this checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO } from './lib.mjs';

const TEXT = readFileSync(join(REPO, 'docs/language.md'), 'utf8');
const SECTIONS = ['Plan', 'Engine', 'Platform', 'Observation'];
const TERMS = ['item', 'plan stage', 'model stage', 'run', 'actor', 'host effect', 'workflow', 'brief', 'prompt', 'context', 'result',
  'return', 'card', 'journal', 'row', 'kind', 'session', 'agent', 'thread', 'run folder'];

/** { section: [{ term, means, carried }] } from the tables under each ## heading. */
function tables() {
  const out = {};
  let section = null;
  for (const line of TEXT.split('\n')) {
    const h = line.match(/^## (.+)$/);
    if (h) { section = h[1].trim(); out[section] = []; continue; }
    const cells = line.match(/^\|(.+)\|$/)?.[1].split('|').map((c) => c.trim());
    if (!section || !cells || cells.length !== 3 || cells[0] === 'Term' || /^-+$/.test(cells[0])) continue;
    out[section].push({ term: cells[0], means: cells[1], carried: cells[2] });
  }
  return out;
}
const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const { KINDS } = await import(pathToFileURL(join(REPO, 'packages/journal/src/index.js')).href);
const ENGINE_SRC = readdirSync(join(REPO, 'packages/engine/src'), { recursive: true }).filter((f) => /\.js$/.test(f)).map((f) => readFileSync(join(REPO, 'packages/engine/src', f), 'utf8')).join('\n');

test('glossary-real: the four context sections, each with a table', () => {
  const t = tables();
  for (const s of SECTIONS) assert.ok(t[s]?.length > 0, `section ${s}`);
  assert.ok(TEXT.includes('## Where contexts meet'), 'says which word to use where contexts meet');
  assert.match(TEXT, /\*\*stage\.\*\*[^\n]*plan stage[^\n]*model stage/, 'the plan stage / model stage line');
});

test('glossary-real: a line for every term the outputs list', () => {
  const terms = new Set(Object.values(tables()).flat().map((r) => r.term));
  const missing = TERMS.filter((t) => !terms.has(t));
  assert.deepEqual(missing, []);
});

test('glossary-real: every path, export, key, kind and run-folder file a line names is real', async (t) => {
  const t2 = tables();
  const checked = { path: 0, template: 0, export: 0, key: 0, kind: 0, file: 0 };
  const problems = [];
  const lines = Object.values(t2).flat().map((r) => r.carried);
  const meet = TEXT.split('## Where contexts meet')[1] ?? '';
  for (const carried of [...lines, ...meet.split('\n')]) {
    let last = null;
    for (const tok of ticks(carried)) {
      if (tok.includes('<')) {
        // A template such as verify/<item>/verdict.json: the part before the first placeholder exists.
        const fixed = tok.slice(0, tok.indexOf('<'));
        checked.template++;
        if (fixed && !existsSync(join(REPO, fixed))) problems.push(`template ${tok}: ${fixed} missing`);
        last = null;
      } else if (tok.includes('/')) {
        checked.path++;
        if (!existsSync(join(REPO, tok))) problems.push(`path ${tok} missing`);
        last = tok;
      } else if (/^[a-z]+\.[a-z]+$/.test(tok) && !/\.(md|json|js|mjs)$/.test(tok)) {
        checked.kind++;
        if (!KINDS.includes(tok)) problems.push(`kind ${tok} not in KINDS`);
      } else if (/\.(md|json)$/.test(tok)) {
        // A run-folder file: the engine source names it.
        checked.file++;
        if (!ENGINE_SRC.includes(`'${tok}'`)) problems.push(`run-folder file ${tok} not named in packages/engine/src`);
      } else if (/^[\w-]+\.m?js$/.test(tok)) {
        // A bare script name in prose: one file of that name exists under plugins/ or packages/.
        checked.file++;
        const found = ['plugins', 'packages'].some((d) => readdirSync(join(REPO, d), { recursive: true }).some((f) => !String(f).includes('node_modules') && String(f).endsWith(`/${tok}`)));
        if (!found) problems.push(`script ${tok} not found`);
      } else if (/^[A-Za-z_]\w*$/.test(tok) && last) {
        if (/\.m?js$/.test(last)) {
          checked.export++;
          const mod = await import(pathToFileURL(join(REPO, last)).href);
          if (!(tok in mod)) problems.push(`${last} does not export ${tok}`);
        } else if (last.endsWith('.json')) {
          checked.key++;
          if (!readFileSync(join(REPO, last), 'utf8').includes(`"${tok}"`)) problems.push(`${last} has no key ${tok}`);
        }
      } else {
        problems.push(`unclassified ${tok}`);
      }
    }
  }
  t.diagnostic(`checked ${JSON.stringify(checked)}`);
  assert.deepEqual(problems, []);
  assert.ok(checked.export >= 15 && checked.kind >= 10 && checked.path >= 30, JSON.stringify(checked));
});
