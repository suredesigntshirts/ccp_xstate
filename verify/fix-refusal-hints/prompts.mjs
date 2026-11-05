// Every stage of every workflow in a checkout's workflows/, rendered by that checkout's own engine with the same
// made-up inputs, and each workflow's pinned hash: { renders: { '<wf> <actor>': sha256 }, hashes: { <wf>: id } }.
// Run on main (bbcdadc) it gave evidence/main-prompts.json; `node prompts.mjs <checkout>` prints it.
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const madeUp = (k) => k === 'task' ? `Made-up task for ${k}: do "the thing" \\ then return.` : { note: `made-up ${k} "q" \\ b`, n: k.length, list: [k, null, true], nested: { url: `https://example.invalid/${k}` } };

export async function prompts(repo) {
  const { loadWorkflow } = await import(pathToFileURL(join(repo, 'packages/engine/src/index.js')).href);
  const { render, chart, stagesOf } = await import(pathToFileURL(join(repo, 'packages/engine/src/stages.js')).href);
  const dir = join(repo, 'workflows');
  const out = { renders: {}, hashes: {} };
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const name = f.replace(/\.json$/, '');
    const spec = loadWorkflow(name, { dir });
    out.hashes[name] = spec.id;
    const invokes = chart(spec).invokes;
    for (const actor of stagesOf(spec)) {
      const inv = invokes.find((i) => i.src === actor);
      if (!inv) continue;
      const input = Object.fromEntries(Object.entries(inv.input ?? {}).map(([k, from]) => [k, from && typeof from === 'object' && 'value' in from ? from.value : madeUp(k)]));
      let text;
      try {
        text = render({ actor, schema: spec.meta.actors[actor], input, defs: spec.meta.schemas ?? {}, run: `v-${name}-${actor}:0.${actor}` });
      } catch (e) { text = `render threw: ${e.message}`; }
      out.renders[`${name} ${actor}`] = createHash('sha256').update(text).digest('hex');
    }
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await prompts(process.argv[2]), null, 1));
